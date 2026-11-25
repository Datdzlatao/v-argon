package com.smartfarm.app.data.remote

import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class SupabaseRestClient(
    private val baseUrl: String = ApiConfig.SUPABASE_URL,
    private val apiKey: String = ApiConfig.SUPABASE_KEY
) {
    var authToken: String? = null

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    private fun resolveToken(): String {
        val current = authToken?.trim()
        return if (!current.isNullOrEmpty()) current else apiKey
    }

    suspend fun <T> queryList(
        table: String,
        params: Map<String, String> = emptyMap(),
        typeToken: TypeToken<List<T>>
    ): List<T> = withContext(Dispatchers.IO) {
        val httpUrlBuilder = "$baseUrl/rest/v1/$table".toHttpUrlOrNull()?.newBuilder() ?: return@withContext emptyList()
        params.forEach { (k, v) -> httpUrlBuilder.addQueryParameter(k, v) }
        val targetUrl = httpUrlBuilder.build()

        fun buildRequest(token: String): Request {
            return Request.Builder()
                .url(targetUrl)
                .addHeader("apikey", apiKey)
                .addHeader("Authorization", "Bearer $token")
                .addHeader("Accept", "application/json")
                .get()
                .build()
        }

        val activeToken = resolveToken()
        try {
            var res = client.newCall(buildRequest(activeToken)).execute()
            if (res.code == 401 && activeToken != apiKey) {
                Log.w("SupabaseRestClient", "queryList got 401 on $table with authToken, fallback to apiKey")
                authToken = null
                res = client.newCall(buildRequest(apiKey)).execute()
            }

            val body = res.body?.string() ?: "[]"
            if (res.isSuccessful) {
                gson.fromJson<List<T>>(body, typeToken.type) ?: emptyList()
            } else {
                Log.e("SupabaseRestClient", "queryList error on $table: code=${res.code}, body=$body")
                emptyList()
            }
        } catch (e: Exception) {
            Log.e("SupabaseRestClient", "queryList exception on $table", e)
            emptyList()
        }
    }

    suspend fun insert(table: String, data: Any): Boolean = withContext(Dispatchers.IO) {
        val json = if (data is String) data else gson.toJson(data)
        val targetUrl = "$baseUrl/rest/v1/$table".toHttpUrlOrNull() ?: return@withContext false

        fun buildRequest(token: String): Request {
            return Request.Builder()
                .url(targetUrl)
                .addHeader("apikey", apiKey)
                .addHeader("Authorization", "Bearer $token")
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=representation")
                .post(json.toRequestBody(jsonMedia))
                .build()
        }

        val activeToken = resolveToken()
        try {
            var res = client.newCall(buildRequest(activeToken)).execute()
            if (res.code == 401 && activeToken != apiKey) {
                Log.w("SupabaseRestClient", "insert got 401 on $table with authToken, fallback to apiKey")
                authToken = null
                res = client.newCall(buildRequest(apiKey)).execute()
            }

            val body = res.body?.string()
            if (!res.isSuccessful) {
                Log.e("SupabaseRestClient", "insert failed on $table: code=${res.code}, body=$body, payload=$json")
            } else {
                Log.d("SupabaseRestClient", "insert success on $table: $body")
            }
            res.isSuccessful
        } catch (e: Exception) {
            Log.e("SupabaseRestClient", "insert exception on $table", e)
            false
        }
    }

    suspend fun upsert(table: String, onConflict: String, data: Any): Boolean = withContext(Dispatchers.IO) {
        val json = if (data is String) data else gson.toJson(data)
        val targetUrl = "$baseUrl/rest/v1/$table".toHttpUrlOrNull()
            ?.newBuilder()
            ?.addQueryParameter("on_conflict", onConflict)
            ?.build() ?: return@withContext false

        fun buildRequest(token: String): Request {
            return Request.Builder()
                .url(targetUrl)
                .addHeader("apikey", apiKey)
                .addHeader("Authorization", "Bearer $token")
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=representation,resolution=merge-duplicates")
                .post(json.toRequestBody(jsonMedia))
                .build()
        }

        val activeToken = resolveToken()
        try {
            var res = client.newCall(buildRequest(activeToken)).execute()
            if (res.code == 401 && activeToken != apiKey) {
                Log.w("SupabaseRestClient", "upsert got 401 on $table with authToken, fallback to apiKey")
                authToken = null
                res = client.newCall(buildRequest(apiKey)).execute()
            }

            val body = res.body?.string()
            if (!res.isSuccessful) {
                Log.e("SupabaseRestClient", "upsert failed on $table: code=${res.code}, body=$body, payload=$json")
            } else {
                Log.d("SupabaseRestClient", "upsert success on $table: $body")
            }
            res.isSuccessful
        } catch (e: Exception) {
            Log.e("SupabaseRestClient", "upsert exception on $table", e)
            false
        }
    }

    suspend fun update(
        table: String,
        filterColumn: String,
        filterValue: String,
        data: Any
    ): Boolean = withContext(Dispatchers.IO) {
        val json = if (data is String) data else gson.toJson(data)
        val targetUrl = "$baseUrl/rest/v1/$table".toHttpUrlOrNull()
            ?.newBuilder()
            ?.addQueryParameter(filterColumn, "eq.$filterValue")
            ?.build() ?: return@withContext false

        fun buildRequest(token: String): Request {
            return Request.Builder()
                .url(targetUrl)
                .addHeader("apikey", apiKey)
                .addHeader("Authorization", "Bearer $token")
                .addHeader("Content-Type", "application/json")
                .addHeader("Prefer", "return=representation")
                .patch(json.toRequestBody(jsonMedia))
                .build()
        }

        val activeToken = resolveToken()
        try {
            var res = client.newCall(buildRequest(activeToken)).execute()
            if (res.code == 401 && activeToken != apiKey) {
                Log.w("SupabaseRestClient", "update got 401 on $table with authToken, fallback to apiKey")
                authToken = null
                res = client.newCall(buildRequest(apiKey)).execute()
            }

            val body = res.body?.string()
            if (!res.isSuccessful) {
                Log.e("SupabaseRestClient", "update failed on $table: code=${res.code}, body=$body, url=$targetUrl")
            } else {
                Log.d("SupabaseRestClient", "update success on $table: $body")
            }
            res.isSuccessful
        } catch (e: Exception) {
            Log.e("SupabaseRestClient", "update exception on $table", e)
            false
        }
    }

    suspend fun delete(table: String, filterColumn: String, filterValue: String): Boolean =
        withContext(Dispatchers.IO) {
            val targetUrl = "$baseUrl/rest/v1/$table".toHttpUrlOrNull()
                ?.newBuilder()
                ?.addQueryParameter(filterColumn, "eq.$filterValue")
                ?.build() ?: return@withContext false

            fun buildRequest(token: String): Request {
                return Request.Builder()
                    .url(targetUrl)
                    .addHeader("apikey", apiKey)
                    .addHeader("Authorization", "Bearer $token")
                    .delete()
                    .build()
            }

            val activeToken = resolveToken()
            try {
                var res = client.newCall(buildRequest(activeToken)).execute()
                if (res.code == 401 && activeToken != apiKey) {
                    Log.w("SupabaseRestClient", "delete got 401 on $table with authToken, fallback to apiKey")
                    authToken = null
                    res = client.newCall(buildRequest(apiKey)).execute()
                }

                val body = res.body?.string()
                if (!res.isSuccessful) {
                    Log.e("SupabaseRestClient", "delete failed on $table: code=${res.code}, body=$body, url=$targetUrl")
                } else {
                    Log.d("SupabaseRestClient", "delete success on $table: code=${res.code}")
                }
                res.isSuccessful
            } catch (e: Exception) {
                Log.e("SupabaseRestClient", "delete exception on $table", e)
                false
            }
        }
}
