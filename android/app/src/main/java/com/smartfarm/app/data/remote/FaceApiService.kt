package com.smartfarm.app.data.remote

import com.google.gson.JsonObject
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

/**
 * Service kết nối tới Face Recognition & Uniform AI Engine (Port 8001 / Funnel Port 10000)
 */
interface FaceApiService {

    @POST("/api/v1/camera/start")
    suspend fun startCamera(
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<JsonObject>

    @POST("/api/v1/camera/stop")
    suspend fun stopCamera(): Response<JsonObject>

    @GET("/api/v1/camera/latest")
    suspend fun getLatestTelemetry(): Response<JsonObject>

    @GET("/api/v1/camera/status")
    suspend fun getCameraStatus(): Response<JsonObject>

    @GET("/api/v1/camera/snapshot")
    suspend fun getSnapshot(
        @Query("overlay") overlay: Boolean = true
    ): Response<ResponseBody>

    @GET("/api/v1/health")
    suspend fun checkHealth(): Response<JsonObject>

    @Multipart
    @POST("/api/v1/faces/enroll")
    suspend fun enrollFace(
        @Part("student_id") studentId: RequestBody,
        @Part("student_name") studentName: RequestBody,
        @Part file: MultipartBody.Part? = null,
        @Part fileThang: MultipartBody.Part? = null,
        @Part fileTrai: MultipartBody.Part? = null,
        @Part filePhai: MultipartBody.Part? = null
    ): Response<JsonObject>
}
