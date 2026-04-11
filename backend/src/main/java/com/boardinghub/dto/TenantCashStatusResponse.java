package com.boardinghub.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TenantCashStatusResponse {
    private boolean hasPendingRequest;
}
