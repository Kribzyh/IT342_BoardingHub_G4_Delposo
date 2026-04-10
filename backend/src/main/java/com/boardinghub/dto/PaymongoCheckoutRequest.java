package com.boardinghub.dto;

import lombok.Data;

@Data
public class PaymongoCheckoutRequest {
    /** e.g. gcash, paymaya */
    private String paymentMethod = "gcash";
    /** Absolute URL where PayMongo redirects after GCash/Maya flow. */
    private String returnUrl;
    /** Optional; defaults to tenant name / email if omitted. */
    private String billingName;
    private String billingPhone;
}
