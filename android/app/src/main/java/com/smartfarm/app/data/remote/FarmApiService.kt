package com.smartfarm.app.data.remote

import com.google.gson.JsonObject
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

interface FarmApiService {

    @POST("/api/chat")
    suspend fun sendChat(
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<JsonObject>

    @Streaming
    @POST("/api/chat/stream")
    suspend fun sendChatStream(
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<ResponseBody>

    @POST("/api/diagnose/base64")
    suspend fun diagnoseDiseaseBase64(
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<JsonObject>

    @GET("/api/chat/history")
    suspend fun getChatHistory(
        @Query("user_id") userId: String,
        @Query("pen_id") penId: String?
    ): Response<JsonObject>

    @POST("/api/scheduler/trigger-briefing")
    suspend fun triggerBriefing(): Response<JsonObject>

    @GET("/api/newsfeed")
    suspend fun getNewsfeed(
        @Query("pen_id") penId: String? = null,
        @Query("limit") limit: Int = 12
    ): Response<JsonObject>

    @POST("/api/devices/control")
    suspend fun controlDevice(
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<JsonObject>

    @POST("/api/animals/transfer")
    suspend fun transferAnimal(
        @Body body: Map<String, String>
    ): Response<JsonObject>

    @GET("/api/staff")
    suspend fun getStaff(): Response<ResponseBody>

    @POST("/api/staff/checkin")
    suspend fun checkInStaff(
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<JsonObject>

    @GET("/api/staff/attendance")
    suspend fun getAttendanceHistory(
        @Query("limit") limit: Int = 20
    ): Response<ResponseBody>

    @Multipart
    @POST("/api/staff/enroll")
    suspend fun enrollStaffFace(
        @Part("staff_id") staffId: RequestBody,
        @Part("staff_name") staffName: RequestBody,
        @Part("role") role: RequestBody,
        @Part("pen_id") penId: RequestBody,
        @Part fileThang: MultipartBody.Part?,
        @Part fileTrai: MultipartBody.Part?,
        @Part filePhai: MultipartBody.Part?
    ): Response<JsonObject>

    @POST("/api/uniform/scan")
    suspend fun scanUniform(
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<JsonObject>

    @GET("/api/tracker/status")
    suspend fun getTrackerStatus(
        @Query("target_id") targetId: String
    ): Response<JsonObject>

    @GET("/api/actions/logs")
    suspend fun getActionLogs(
        @Query("target_id") targetId: String?,
        @Query("limit") limit: Int = 20
    ): Response<JsonObject>

    @POST("/api/camera/configure")
    suspend fun configureCamera(
        @Body body: Map<String, String>
    ): Response<JsonObject>

    @PATCH("/api/pens/{pen_id}")
    suspend fun updatePenMetadata(
        @Path("pen_id") penId: String,
        @Body updates: Map<String, String>
    ): Response<JsonObject>
}
