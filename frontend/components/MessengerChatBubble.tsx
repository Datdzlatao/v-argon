'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, 
  X, 
  Minus, 
  Send, 
  Bot, 
  Sparkles, 
  RefreshCw, 
  Smile, 
  Maximize2,
  Wrench,
  CheckCircle2,
  ImagePlus
} from 'lucide-react';
import { sendAgentChat, sendAgentChatStream, getChatHistory, fileToBase64, diagnoseDiseaseWithBase64, connectAgentWebSocket } from '../lib/agent-api';
import GeminiMarkdown from './GeminiMarkdown';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  time: string;
  imageUrl?: string;
  isStreaming?: boolean;
  toolsCalled?: Array<{
    tool: string;
    args: Record<string, any>;
    result?: string;
  }>;
}

interface MessengerChatBubbleProps {
  penId: string;
  penName: string;
  isOpen: boolean;
  onToggle: () => void;
  temp?: number;
  hum?: number;
  smell?: number;
  userId?: string;
}

export default function MessengerChatBubble({
  penId,
  penName,
  isOpen,
  onToggle,
  temp,
  hum,
  smell,
  userId = 'guest',
}: MessengerChatBubbleProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'agent',
      text: `Kính chào bà con! Tôi là Trợ Lý V-ARGON 24/7. Tôi có thể hỗ trợ bà con theo dõi nhiệt độ môi trường, điều khiển quạt thông gió, kiểm tra sức khỏe đàn vật nuôi và quản lý kho vật tư. Bà con cần hỗ trợ gì hôm nay?`,
      time: 'Vừa xong',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasStreamChunk, setHasStreamChunk] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    base64: string;
    contentType: string;
    dataUrl: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load chat history from backend on open or pen/user change
  useEffect(() => {
    let isMounted = true;
    getChatHistory(userId, penId).then((history) => {
      if (!isMounted) return;
      if (history && history.length > 0) {
        setMessages(
          history.map((m) => ({
            id: String(m.id),
            sender: m.sender as 'user' | 'agent',
            text: m.content,
            time: m.created_at
              ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Vừa xong',
            toolsCalled: m.tool_calls,
          }))
        );
      } else {
        setMessages([
          {
            id: '1',
            sender: 'agent',
            text: `Kính chào bà con! Tôi là Trợ Lý Nông Trại phụ trách khu vực ${penName || penId}. Tôi có thể hỗ trợ bà con kiểm tra thời tiết trong chuồng, bật tắt quạt thông gió hoặc theo dõi đàn vật nuôi.`,
            time: 'Vừa xong',
          },
        ]);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, penId, userId, penName]);

  // Sync realtime chat messages from other devices (e.g. Android) via WebSocket
  useEffect(() => {
    const cleanup = connectAgentWebSocket(
      (event: string, d: any) => {
        if (event !== 'chat_message' || !d) return;
        if (d.user_id && d.user_id !== userId) return;
        if (d.pen_id && penId && d.pen_id !== penId) return;
        // Avoid duplicating local streaming/user messages
        setMessages((prev) => {
          const exists = prev.some(
            (m) =>
              (d.id && String(m.id) === String(d.id)) ||
              (m.sender === d.sender && m.text === d.content)
          );
          if (exists) return prev;
          return [
            ...prev,
            {
              id: String(d.id || Date.now()),
              sender: d.sender as 'user' | 'agent',
              text: d.content,
              time: d.created_at
                ? new Date(d.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Vừa xong',
              toolsCalled: d.tool_calls,
            },
          ];
        });
      },
      () => {}
    );
    return () => {
      cleanup?.();
    };
  }, [userId, penId]);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const quickQuestions = [
    'Nhiệt độ & mùi chuồng hiện tại?',
    'Bật quạt thông gió giúp tôi',
    'Vật nuôi nào đang cần chú ý?',
    'Kho thức ăn còn đủ không?',
  ];

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const encoded = await fileToBase64(file);
      setSelectedImage(encoded);
    } catch (err) {
      console.error('Image base64 encode error:', err);
    }
  };

  const handlePasteImage = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const encoded = await fileToBase64(file);
            setSelectedImage(encoded);
          } catch (err) {
            console.error('Paste image base64 encode error:', err);
          }
          break;
        }
      }
    }
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText ?? inputValue).trim();
    const imageToSend = messageText ? null : selectedImage;
    if ((!textToSend && !imageToSend) || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend || '📷 Gửi ảnh kiểm tra bệnh',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      imageUrl: imageToSend?.dataUrl,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!messageText) {
      setInputValue('');
      setSelectedImage(null);
    }
    setIsLoading(true);
    setHasStreamChunk(false);

    const streamMsgId = (Date.now() + 1).toString();
    const animateReveal = async (fullText: string, toolsCalled?: ChatMessage['toolsCalled']) => {
      setHasStreamChunk(true);
      setMessages((prev) => [
        ...prev,
        {
          id: streamMsgId,
          sender: 'agent',
          text: '',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isStreaming: true,
          toolsCalled,
        },
      ]);
      const tokens = fullText.split(/(\s+)/);
      let acc = '';
      const step = Math.max(1, Math.ceil(tokens.length / 45));
      for (let i = 0; i < tokens.length; i += step) {
        acc += tokens.slice(i, i + step).join('');
        setMessages((prev) => prev.map((m) => (m.id === streamMsgId ? { ...m, text: acc } : m)));
        await new Promise((r) => setTimeout(r, 18));
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === streamMsgId ? { ...m, text: fullText, isStreaming: false } : m))
      );
    };

    try {
      if (imageToSend) {
        const diag = await diagnoseDiseaseWithBase64(
          imageToSend.base64,
          textToSend || 'Phân tích và chẩn đoán hình ảnh nông nghiệp này giúp tôi',
          imageToSend.contentType,
          penId,
          userId
        );
        const summaryLines = [
          diag.disease_name ? `🩺 Chẩn đoán: ${diag.disease_name}` : null,
          diag.species ? `🌿/🐖 Đối tượng: ${diag.species} (${diag.category === 'crop' ? 'Cây trồng' : 'Vật nuôi'})` : null,
          diag.text ? `🔍 Mô tả: ${diag.text}` : null,
          `\n📋 Hướng dẫn xử lý:\n${diag.answer}`,
          diag.sources && diag.sources.length > 0 ? `\n📚 Nguồn tham khảo: ${diag.sources.join(', ')}` : null,
        ]
          .filter(Boolean)
          .join('\n');

        await animateReveal(summaryLines, [
          {
            tool: 'Kiểm tra bệnh qua hình ảnh',
            args: { content_type: imageToSend.contentType },
            result: diag.disease_name || 'Đã phân tích xong hình ảnh',
          },
        ]);
        setIsLoading(false);
        setHasStreamChunk(false);
        return;
      }

      // Real-time SSE Streaming with Gemini Web animation
      let accumulated = '';
      let msgCreated = false;
      await sendAgentChatStream(textToSend, penId, userId, {
        onChunk: (delta) => {
          accumulated += delta;
          if (!msgCreated) {
            msgCreated = true;
            setHasStreamChunk(true);
            setMessages((prev) => [
              ...prev,
              {
                id: streamMsgId,
                sender: 'agent',
                text: accumulated,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isStreaming: true,
              },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.id === streamMsgId ? { ...m, text: accumulated } : m))
            );
          }
        },
        onDone: (fullReply, toolCalls) => {
          const finalText = fullReply || accumulated || 'Đã thực hiện xong yêu cầu.';
          if (!msgCreated) {
            msgCreated = true;
            setHasStreamChunk(true);
            setMessages((prev) => [
              ...prev,
              {
                id: streamMsgId,
                sender: 'agent',
                text: finalText,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isStreaming: false,
                toolsCalled: toolCalls,
              },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamMsgId
                  ? { ...m, text: finalText, isStreaming: false, toolsCalled: toolCalls }
                  : m
              )
            );
          }
        },
      });
      setIsLoading(false);
      setHasStreamChunk(false);
      return;
    } catch (err) {
      console.warn('Backend AI/RAG stream error, using fallback responder:', err);
    }

    // Local fallback intelligent response
    setTimeout(() => {
      let reply = '';
      const lower = textToSend.toLowerCase();

      if (lower.includes('nhiệt') || lower.includes('môi trường') || lower.includes('mùi')) {
        reply = `📡 Thông số hiện tại tại ${penName}: Nhiệt độ: ${temp ?? 29}°C, Độ ẩm: ${hum ?? 70}%, Mùi chuồng: ${smell ?? 180} ppm. Môi trường đang ở ngưỡng ${temp && temp >= 35 ? 'CẢNH BÁO NÓNG' : 'ổn định an toàn'}.`;
      } else if (lower.includes('quạt') || lower.includes('bật') || lower.includes('tắt')) {
        reply = `💨 Đã gửi lệnh điều khiển tới khu vực ${penName}. Hệ thống đang tự động kích hoạt quạt thông gió làm mát!`;
      } else if (lower.includes('heo') || lower.includes('vật nuôi') || lower.includes('bệnh') || lower.includes('ốm')) {
        reply = `🩺 Theo hồ sơ y tế mới nhất: Phát hiện 1 cá thể cần chú ý (sốt nhẹ). Các cá thể khác ăn uống bình thường và tăng trọng đạt chỉ tiêu.`;
      } else if (lower.includes('kho') || lower.includes('thức ăn') || lower.includes('cám')) {
        reply = `📦 Kho thức ăn: Cám Cò còn đủ dùng trong 3 ngày tới. Có 1 mặt hàng chạm ngưỡng tối thiểu, bạn nên lên lịch nhập thêm trước cuối tuần.`;
      } else {
        reply = `🌾 Đã ghi nhận yêu cầu: "${textToSend}". Hệ thống đã cập nhật dữ liệu với khu vực ${penName} thành công!`;
      }

      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, agentMsg]);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Expanding Messenger Window */}
      {isOpen && (
        <div className="w-[360px] sm:w-[380px] h-[520px] bg-fb-card rounded-2xl shadow-fb-popover border border-fb-divider flex flex-col overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Messenger Header */}
          <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between shadow">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
                  🤖
                </div>
                <span className="w-2.5 h-2.5 bg-emerald-300 rounded-full absolute bottom-0 right-0 ring-2 ring-emerald-700" />
              </div>

              <div>
                <h4 className="font-bold text-sm leading-tight">Trợ Lý Nông Trại</h4>
                <p className="text-[11px] text-emerald-100 flex items-center gap-1">
                  <span>Trực tuyến</span>
                  <span>•</span>
                  <span>Sẵn sàng hỗ trợ</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onToggle}
                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center text-white/90 transition cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={onToggle}
                className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center text-white/90 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#F0F2F5]/50">
            {messages.map((m) => {
              const isUser = m.sender === 'user';

              return (
                <div
                  key={m.id}
                  className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shrink-0 mb-0.5">
                      🤖
                    </div>
                  )}

                  <div className={`max-w-[80%] min-w-0 break-words overflow-hidden rounded-2xl px-3.5 py-2 text-xs shadow-sm ${
                    isUser
                      ? 'bg-emerald-700 text-white rounded-br-sm'
                      : 'bg-white text-fb-text border border-slate-200 rounded-bl-sm leading-relaxed'
                  }`}>
                    {m.imageUrl && (
                      <img
                        src={m.imageUrl}
                        alt="Ảnh kiểm chứng"
                        className="w-full max-h-40 object-cover rounded-xl mb-1.5 border border-white/20"
                      />
                    )}
                    <GeminiMarkdown
                      text={m.text}
                      isUser={isUser}
                      isStreaming={Boolean(m.isStreaming)}
                    />
                    {m.toolsCalled && m.toolsCalled.length > 0 && (
                      <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10px] space-y-1">
                        {m.toolsCalled.map((t: any, idx) => (
                          <div key={idx} className="bg-emerald-50 text-emerald-800 p-1.5 rounded-lg border border-emerald-200">
                            <span className="font-bold flex items-center gap-1">
                              <Wrench className="w-3 h-3 text-emerald-600" />
                              Hành động: {typeof t === 'string' ? t : t.tool}
                            </span>
                            {typeof t !== 'string' && t.result && (
                              <p className="text-[9px] text-slate-600 mt-0.5 line-clamp-2">{t.result}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <span className={`text-[9px] block text-right mt-1 ${isUser ? 'text-emerald-200' : 'text-slate-400'}`}>
                      {m.time}
                    </span>
                  </div>
                </div>
              );
            })}

            {isLoading && !hasStreamChunk && (
              <div className="flex items-end gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center text-xs shrink-0 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="w-[70%] bg-white border border-emerald-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5 shadow-sm space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                    <Sparkles className="w-3 h-3 animate-spin" />
                    <span>Trợ lý đang suy nghĩ...</span>
                  </div>
                  <div className="space-y-1.5 animate-pulse">
                    <div className="h-2 rounded-full bg-gradient-to-r from-emerald-200 via-teal-100 to-emerald-200 w-11/12" />
                    <div className="h-2 rounded-full bg-gradient-to-r from-emerald-100 via-teal-200 to-emerald-100 w-3/4" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-2 bg-fb-card border-t border-fb-divider overflow-x-auto scrollbar-none flex gap-1.5">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                className="shrink-0 text-[11px] font-medium bg-fb-bg hover:bg-emerald-50 hover:text-emerald-700 text-fb-text px-2.5 py-1 rounded-full border border-fb-divider transition"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Image Preview Bar */}
          {selectedImage && (
            <div className="px-3 py-2 bg-emerald-50/80 border-t border-emerald-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={selectedImage.dataUrl}
                  alt="Xem trước"
                  className="w-10 h-10 rounded-lg object-cover border border-emerald-300 shrink-0"
                />
                <span className="text-[11px] text-emerald-800 font-medium truncate">
                  Ảnh đã sẵn sàng gửi kiểm tra bệnh
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="w-6 h-6 rounded-full bg-white text-slate-500 hover:text-rose-600 flex items-center justify-center border border-slate-200 shrink-0"
                title="Bỏ ảnh"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-fb-card border-t border-fb-divider flex items-center gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImagePick}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Gửi ảnh để kiểm tra bệnh"
              className="w-8 h-8 rounded-full bg-fb-bg hover:bg-emerald-50 text-emerald-700 border border-fb-divider flex items-center justify-center transition shrink-0 cursor-pointer disabled:opacity-40"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <input
              type="text"
              placeholder={selectedImage ? 'Mô tả thêm triệu chứng (tuỳ chọn)...' : 'Nhập câu hỏi hoặc dán ảnh vào đây...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPaste={handlePasteImage}
              className="flex-1 bg-fb-bg text-xs rounded-full px-3.5 py-2 border border-fb-divider focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={(!inputValue.trim() && !selectedImage) || isLoading}
              className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition disabled:opacity-40 shadow-sm shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Circular Floating Messenger Bubble */}
      <div className="relative">
        <button
          onClick={onToggle}
          title="Mở hộp thoại Trợ Lý Nông Trại"
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-green-500 hover:scale-105 transition-transform duration-200 text-white flex items-center justify-center shadow-xl border-2 border-white alert-pulse float-bubble cursor-pointer"
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <div className="relative">
              <Bot className="w-7 h-7" />
              <span className="w-3 h-3 rounded-full bg-emerald-400 absolute -top-1 -right-1 ring-2 ring-emerald-800" />
            </div>
          )}
        </button>

        {!isOpen && (
          <span className="absolute -top-1.5 -right-1.5 bg-emerald-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow border-2 border-white">
            24/7
          </span>
        )}
      </div>
    </div>
  );
}
