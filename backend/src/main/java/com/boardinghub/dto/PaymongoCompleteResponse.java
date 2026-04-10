package com.boardinghub.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PaymongoCompleteResponse {
    private boolean recorded;
    private String message;
    private PaymentRecordDto record;
}
