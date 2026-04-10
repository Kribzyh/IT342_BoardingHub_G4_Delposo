package com.boardinghub.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class PaymentRecordDto {
    private Long id;
    private String paymongoPaymentIntentId;
    private BigDecimal amountPesos;
    private String currency;
    private String paymentMethodType;
    private String paymongoStatus;
    private LocalDateTime recordedAt;
    private String propertyName;
    private String roomNumber;
    /** Present for landlord view */
    private String tenantName;
    /** Present for tenant view */
    private String landlordName;
}
