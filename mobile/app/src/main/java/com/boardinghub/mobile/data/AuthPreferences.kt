package com.boardinghub.mobile.data

import android.content.Context
import android.content.SharedPreferences

object AuthPreferences {
    private const val PREFS_NAME = "boardinghub_auth"
    private const val KEY_TOKEN = "access_token"
    private const val KEY_USER_JSON = "user_json"

    @Volatile
    private var prefs: SharedPreferences? = null

    fun init(context: Context) {
        if (prefs == null) {
            synchronized(this) {
                if (prefs == null) {
                    prefs = context.applicationContext.getSharedPreferences(
                        PREFS_NAME,
                        Context.MODE_PRIVATE
                    )
                }
            }
        }
    }

    private fun requirePrefs(): SharedPreferences =
        prefs ?: throw IllegalStateException("AuthPreferences.init was not called")

    fun saveSession(accessToken: String, userJson: String) {
        requirePrefs().edit()
            .putString(KEY_TOKEN, accessToken)
            .putString(KEY_USER_JSON, userJson)
            .apply()
    }

    fun accessToken(): String? = requirePrefs().getString(KEY_TOKEN, null)

    fun userJson(): String? = requirePrefs().getString(KEY_USER_JSON, null)

    fun clear() {
        requirePrefs().edit().clear().apply()
    }

    fun isLoggedIn(): Boolean = !accessToken().isNullOrBlank()
}
