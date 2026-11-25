package com.smartfarm.app.data.remote

import com.google.gson.Gson
import com.smartfarm.app.data.models.AuthErrorResponse
import com.smartfarm.app.data.models.AuthTokenResponse
import com.smartfarm.app.data.models.UserSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class SupabaseAuthClient(
    private val baseUrl: String = ApiConfig.SUPABASE_URL,
    private val apiKey: String = ApiConfig.SUPABASE_KEY
) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    suspend fun signInWithPassword(email: String, password: String): Result<UserSession> =
        withContext(Dispatchers.IO) {
            try {
                val url = "$baseUrl/auth/v1/token?grant_type=password"
                val jsonBody = gson.toJson(mapOf("email" to email.trim(), "password" to password))
                val request = Request.Builder()
                    .url(url)
                    .addHeader("apikey", apiKey)
                    .addHeader("Content-Type", "application/json")
                    .post(jsonBody.toRequestBody(jsonMedia))
                    .build()

                val response = client.newCall(request).execute()
                val responseBody = response.body?.string().orEmpty()

                if (response.isSuccessful) {
                    val tokenResponse = gson.fromJson(responseBody, AuthTokenResponse::class.java)
                    val session = UserSession(
                        email = tokenResponse.user.email ?: email.trim(),
                        userId = tokenResponse.user.id,
                        accessToken = tokenResponse.accessToken,
                        refreshToken = tokenResponse.refreshToken,
                        isDemo = false
                    )
                    Result.success(session)
                } else {
                    val errorMsg = parseErrorMessage(responseBody)
                    Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                Result.failure(Exception(e.localizedMessage ?: "Lỗi kết nối tới máy chủ Supabase Authenticator"))
            }
        }

    suspend fun signUp(email: String, password: String): Result<String> =
        withContext(Dispatchers.IO) {
            try {
                val url = "$baseUrl/auth/v1/signup"
                val jsonBody = gson.toJson(mapOf("email" to email.trim(), "password" to password))
                val request = Request.Builder()
                    .url(url)
                    .addHeader("apikey", apiKey)
                    .addHeader("Content-Type", "application/json")
                    .post(jsonBody.toRequestBody(jsonMedia))
                    .build()

                val response = client.newCall(request).execute()
                val responseBody = response.body?.string().orEmpty()

                if (response.isSuccessful) {
                    Result.success("Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác nhận tài khoản.")
                } else {
                    val errorMsg = parseErrorMessage(responseBody)
                    Result.failure(Exception(errorMsg))
                }
            } catch (e: Exception) {
                Result.failure(Exception(e.localizedMessage ?: "Lỗi kết nối tới máy chủ Supabase Authenticator"))
            }
        }

    suspend fun signOut(accessToken: String?) = withContext(Dispatchers.IO) {
        if (accessToken.isNullOrBlank()) return@withContext
        try {
            val url = "$baseUrl/auth/v1/logout"
            val request = Request.Builder()
                .url(url)
                .addHeader("apikey", apiKey)
                .addHeader("Authorization", "Bearer $accessToken")
                .post("{}".toRequestBody(jsonMedia))
                .build()

            client.newCall(request).execute()
        } catch (_: Exception) {
            // Ignore logout network errors
        }
    }

    private fun parseErrorMessage(json: String): String {
        return try {
            val err = gson.fromJson(json, AuthErrorResponse::class.java)
            val rawMsg = err.msg ?: err.message ?: err.errorDescription ?: err.error ?: "Đăng nhập thất bại"
            translateError(rawMsg)
        } catch (_: Exception) {
            "Đã có lỗi xảy ra trong quá trình xác thực."
        }
    }

    private fun translateError(rawMsg: String): String {
        val lower = rawMsg.lowercase()
        return when {
            lower.contains("invalid login credentials") || lower.contains("invalid_grant") || lower.contains("invalid_credentials") ->
                "Email hoặc mật khẩu không chính xác."
            lower.contains("email not confirmed") ->
                "Tài khoản chưa được kích hoạt. Vui lòng kiểm tra hộp thư email của bạn để xác thực liên kết trước khi đăng nhập."
            lower.contains("user already registered") ->
                "Email này đã được đăng ký tài khoản. Vui lòng chuyển sang Đăng Nhập."
            lower.contains("password should be at least") ->
                "Mật khẩu phải có độ dài từ 6 ký tự trở lên."
            lower.contains("email address") && lower.contains("invalid") ->
                "Địa chỉ email không đúng định dạng."
            else -> rawMsg
        }
    }
}
