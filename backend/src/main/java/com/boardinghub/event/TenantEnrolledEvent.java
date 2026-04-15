package com.boardinghub.event;

import java.time.LocalDateTime;

public record TenantEnrolledEvent(Long tenantId, Long roomId, Long propertyId, LocalDateTime enrolledAt) {
}
