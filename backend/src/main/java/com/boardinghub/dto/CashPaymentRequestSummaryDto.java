package com.boardinghub.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class CashPaymentRequestSummaryDto {
    private Long id;
    private String tenantName;
    private String tenantEmail;
    private String propertyName;
    private String roomNumber;
    private LocalDateTime submittedAt;
    private boolean hasPhoto;
}
