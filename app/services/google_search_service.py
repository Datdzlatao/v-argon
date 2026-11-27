import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.config import get_settings

logger = logging.getLogger("smart_manager.google_search")


class GoogleSearchService:
    """
    Service integrating Web Search (Tavily Search API + Gemini Google Search Grounding fallback)
    and generating structured market/product price analysis for the MCP server & AI Agent.
    """

    def __init__(self):
        self.settings = get_settings()
        self._tavily_client = None
        if self.settings.is_tavily_configured:
            try:
                from tavily import TavilyClient
                self._tavily_client = TavilyClient(api_key=self.settings.TAVILY_API_KEY)
            except Exception as e:
                logger.warning(f"Could not initialize Tavily client for GoogleSearchService: {e}")

        self._genai_client = None
        if self.settings.is_gemini_configured:
            try:
                from google import genai
                self._genai_client = genai.Client(api_key=self.settings.GEMINI_API_KEY)
            except Exception as e:
                logger.warning(f"Could not initialize Gemini client for GoogleSearchService: {e}")

    def _tavily_search(self, query: str, num_results: int = 5) -> dict[str, Any]:
        """Call Tavily Search SDK and return normalized search items + optional answer."""
        if not self._tavily_client:
            from tavily import TavilyClient
            self._tavily_client = TavilyClient(api_key=self.settings.TAVILY_API_KEY)

        payload = self._tavily_client.search(
            query=query,
            search_depth="basic",
            max_results=max(1, min(int(num_results), 10)),
            include_answer=True,
            timeout=15,
        )

        items = payload.get("results") or []
        results: list[dict[str, str]] = []
        for item in items:
            results.append({
                "title": str(item.get("title") or "").strip(),
                "link": str(item.get("url") or "").strip(),
                "snippet": str(item.get("content") or "").strip(),
            })
        return {
            "results": results,
            "raw_summary": str(payload.get("answer") or "").strip(),
        }

    def _gemini_grounded_search(self, query: str) -> dict[str, Any]:
        """
        Use Gemini's built-in Google Search Grounding (`types.GoogleSearch`)
        when Tavily API key is not configured.
        """
        if not self._genai_client:
            raise RuntimeError(
                "Chưa cấu hình TAVILY_API_KEY hoặc GEMINI_API_KEY."
            )

        from google.genai import types

        response = self._genai_client.models.generate_content(
            model=self.settings.GEMINI_MODEL,
            contents=(
                f"Hãy tìm kiếm trên Google thông tin mới nhất và chính xác nhất về:\n{query}\n"
                "Liệt kê rõ các mức giá, đơn vị tính, nguồn/đơn vị bán và thời điểm cập nhật."
            ),
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.1,
            ),
        )

        text = (response.text or "").strip()
        sources: list[dict[str, str]] = []

        candidates = getattr(response, "candidates", None) or []
        if candidates:
            grounding_meta = getattr(candidates[0], "grounding_metadata", None)
            chunks = getattr(grounding_meta, "grounding_chunks", None) or []
            for ch in chunks:
                web = getattr(ch, "web", None)
                if web:
                    sources.append({
                        "title": str(getattr(web, "title", "") or "").strip(),
                        "link": str(getattr(web, "uri", "") or "").strip(),
                        "snippet": "",
                    })

        return {"summary_text": text, "sources": sources}

    def search_web(self, query: str, num_results: int = 5) -> dict[str, Any]:
        """
        Perform web search using Tavily Search API if configured,
        falling back to Gemini Google Search Grounding.
        """
        clean_query = (query or "").strip()
        if not clean_query:
            return {"engine": "none", "query": "", "results": [], "raw_summary": ""}

        if self.settings.is_tavily_configured:
            try:
                tavily_data = self._tavily_search(clean_query, num_results=num_results)
                return {
                    "engine": "Tavily Search API",
                    "query": clean_query,
                    "results": tavily_data.get("results", []),
                    "raw_summary": tavily_data.get("raw_summary", ""),
                }
            except Exception as e:
                logger.warning(f"Tavily Search API failed, falling back to Gemini Grounding: {e}")

        if self._genai_client:
            grounded = self._gemini_grounded_search(clean_query)
            return {
                "engine": "Google Search Grounding (Gemini)",
                "query": clean_query,
                "results": grounded.get("sources", [])[:num_results],
                "raw_summary": grounded.get("summary_text", ""),
            }

        raise RuntimeError(
            "Không thể tìm kiếm web: vui lòng cấu hình TAVILY_API_KEY hoặc GEMINI_API_KEY trong .env."
        )

    @staticmethod
    def _extract_vnd_prices(text: str) -> list[float]:
        """Extract numeric price candidates in VND from Vietnamese text snippets."""
        if not text:
            return []
        matches = re.findall(
            r"(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(?:đ|vnđ|vnd|đồng|ngàn|nghìn|k\b|triệu)",
            text,
            flags=re.IGNORECASE,
        )
        prices: list[float] = []
        for raw in matches:
            normalized = raw.replace(".", "").replace(",", "")
            try:
                val = float(normalized)
                if val > 0:
                    prices.append(val)
            except ValueError:
                continue
        return prices

    def _analyze_with_gemini(
        self,
        product_name: str,
        region: str,
        purpose: str,
        search_payload: dict[str, Any],
    ) -> str:
        """Synthesize search results into a structured Vietnamese price analysis report."""
        results = search_payload.get("results") or []
        raw_summary = search_payload.get("raw_summary") or ""

        snippets_block = "\n".join(
            f"- [{r.get('title') or 'Nguồn'}]({r.get('link') or ''}): {r.get('snippet') or ''}"
            for r in results
        )

        prompt = f"""Bạn là chuyên gia phân tích thị trường nông nghiệp và vật tư trang trại tại Việt Nam.
Hãy phân tích giá sản phẩm dựa trên dữ liệu tìm kiếm Google vừa thu thập được dưới đây.

Sản phẩm cần phân tích: {product_name}
Khu vực: {region}
Mục đích sử dụng: {purpose}
Công cụ tìm kiếm: {search_payload.get('engine')}

Dữ liệu tìm kiếm từ Google:
{snippets_block if snippets_block else '(Không có snippet rời)'}

Tóm tắt dữ liệu tìm kiếm thực tế:
{raw_summary if raw_summary else '(Xem các nguồn ở trên)'}

Hãy trình bày kết quả phân tích bằng tiếng Việt rõ ràng, ngắn gọn, có số liệu cụ thể theo cấu trúc:
1. **Mức giá tham khảo**: Thấp nhất – Cao nhất – Mức phổ biến (nêu rõ đơn vị tính như đ/kg, đ/bao, đ/con...).
2. **So sánh các nguồn / nhà cung cấp**: Tóm tắt ngắn gọn sự chênh lệch giá giữa các nguồn tìm được.
3. **Nhận định xu hướng & yếu tố ảnh hưởng**: Đánh giá mặt bằng giá hiện tại (cao/thấp/ổn định) và các yếu tố chi phí.
4. **Khuyến nghị hành động cho trang trại**: Nên nhập kho, xuất chuồng, thu hoạch hay chờ thêm dựa trên mục đích "{purpose}".
Lưu ý: Chỉ nêu số liệu có trong dữ liệu tìm kiếm; nếu thiếu dữ liệu chính xác hãy nói rõ cần xác minh thêm với đại lý địa phương."""

        response = self._genai_client.models.generate_content(
            model=self.settings.GEMINI_MODEL,
            contents=prompt,
        )
        return (response.text or "").strip()

    def search_and_analyze_price(
        self,
        product_name: str,
        region: str = "Việt Nam",
        purpose: str = "tham khảo mua bán",
        num_results: int = 6,
    ) -> dict[str, Any]:
        """Search Google for product prices and return structured search results + price analysis."""
        clean_product = (product_name or "").strip()
        if not clean_product:
            raise ValueError("Vui lòng nhập tên sản phẩm cần tìm kiếm và phân tích giá.")

        query = f"giá {clean_product} hôm nay {region}".strip()
        search_payload = self.search_web(query=query, num_results=num_results)
        results = search_payload.get("results") or []
        raw_summary = search_payload.get("raw_summary") or ""

        combined_text = raw_summary + "\n" + "\n".join(
            f"{r.get('title', '')} {r.get('snippet', '')}" for r in results
        )
        extracted_prices = self._extract_vnd_prices(combined_text)

        analysis_text = ""
        if self._genai_client:
            try:
                analysis_text = self._analyze_with_gemini(
                    product_name=clean_product,
                    region=region,
                    purpose=purpose,
                    search_payload=search_payload,
                )
            except Exception as e:
                logger.warning(f"Gemini price analysis failed, using statistical fallback: {e}")

        if not analysis_text:
            if extracted_prices:
                min_p = min(extracted_prices)
                max_p = max(extracted_prices)
                avg_p = sum(extracted_prices) / len(extracted_prices)
                analysis_text = (
                    f"1. **Mức giá ghi nhận từ kết quả tìm kiếm**: "
                    f"Thấp nhất ~{min_p:,.0f} đ | Cao nhất ~{max_p:,.0f} đ | Trung bình ~{avg_p:,.0f} đ.\n"
                    f"2. **Dữ liệu tổng hợp**: {raw_summary or 'Xem danh sách nguồn Google bên dưới.'}"
                )
            else:
                analysis_text = raw_summary or (
                    "Đã tìm thấy các kết quả liên quan trên Google nhưng chưa trích xuất được đơn giá cụ thể."
                )

        return {
            "product_name": clean_product,
            "region": region,
            "purpose": purpose,
            "query": query,
            "engine": search_payload.get("engine"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "results": results,
            "extracted_prices": extracted_prices,
            "analysis": analysis_text,
        }


google_search_service = GoogleSearchService()
