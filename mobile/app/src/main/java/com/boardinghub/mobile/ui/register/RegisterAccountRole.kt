package com.boardinghub.mobile.ui.register

import androidx.annotation.StringRes
import com.boardinghub.mobile.R

enum class RegisterAccountRole(
    val apiValue: String,
    @StringRes val labelRes: Int
) {
    TENANT("TENANT", R.string.role_tenant),
    LANDLORD("LANDLORD", R.string.role_landlord)
}
