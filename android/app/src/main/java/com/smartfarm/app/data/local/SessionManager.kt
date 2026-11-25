package com.smartfarm.app.data.local

import android.content.Context
import android.content.SharedPreferences
import com.smartfarm.app.data.models.UserSession

class SessionManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("smart_farm_auth_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_IS_LOGGED_IN = "key_is_logged_in"
        private const val KEY_EMAIL = "key_email"
        private const val KEY_USER_ID = "key_user_id"
        private const val KEY_ACCESS_TOKEN = "key_access_token"
        private const val KEY_REFRESH_TOKEN = "key_refresh_token"
        private const val KEY_IS_DEMO = "key_is_demo"
    }

    fun saveSession(session: UserSession) {
        prefs.edit().apply {
            putBoolean(KEY_IS_LOGGED_IN, true)
            putString(KEY_EMAIL, session.email)
            putString(KEY_USER_ID, session.userId)
            putString(KEY_ACCESS_TOKEN, session.accessToken)
            putString(KEY_REFRESH_TOKEN, session.refreshToken)
            putBoolean(KEY_IS_DEMO, session.isDemo)
            apply()
        }
    }

    fun getSession(): UserSession? {
        val isLoggedIn = prefs.getBoolean(KEY_IS_LOGGED_IN, false)
        if (!isLoggedIn) return null

        val email = prefs.getString(KEY_EMAIL, null) ?: return null
        val userId = prefs.getString(KEY_USER_ID, null) ?: "user_${System.currentTimeMillis()}"
        val accessToken = prefs.getString(KEY_ACCESS_TOKEN, null)
        val refreshToken = prefs.getString(KEY_REFRESH_TOKEN, null)
        val isDemo = prefs.getBoolean(KEY_IS_DEMO, false)

        return UserSession(
            email = email,
            userId = userId,
            accessToken = accessToken,
            refreshToken = refreshToken,
            isDemo = isDemo
        )
    }

    fun clearSession() {
        prefs.edit().clear().apply()
    }
}
