package com.boardinghub.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class CashPaymentRequestDetailDto {
    private Long id;
    private String tenantName;
    private String tenantEmail;
    private String propertyName;
    private String roomNumber;
    private String monthlyRatePesos;
    private String description;
    private boolean hasPhoto;
    private LocalDateTime submittedAt;
    private String status;
}
