package com.boardinghub.mobile.data

/**
 * Holds Google ID token and profile hints between the first /auth/google call (428)
 * and the dedicated completion screen. Cleared after submit or cancel.
 */
object GoogleSignInPending {

    @Volatile
    var idToken: String? = null

    @Volatile
    var email: String? = null

    @Volatile
    var suggestedFullName: String? = null

    fun setForProfileCompletion(
        idToken: String,
        email: String,
        suggestedFullName: String?
    ) {
        this.idToken = idToken
        this.email = email
        this.suggestedFullName = suggestedFullName
    }

    fun clear() {
        idToken = null
        email = null
        suggestedFullName = null
    }

    fun isReady(): Boolean = !idToken.isNullOrBlank() && !email.isNullOrBlank()
}
