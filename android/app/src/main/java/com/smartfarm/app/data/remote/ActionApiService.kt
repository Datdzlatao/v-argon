package com.smartfarm.app.data.remote

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

/**
 * Service kết nối tới Action Tracking Vision Engine (Port 8002 / Funnel Port 443)
 */
interface ActionApiService {

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

    @POST("/api/camera/stop")
    suspend fun stopCamera(
        @Body body: Map<String, String>
    ): Response<JsonObject>

    @GET("/health")
    suspend fun checkHealth(): Response<JsonObject>
}
