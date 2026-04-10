package com.boardinghub.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "rent_payments",
        uniqueConstraints = @UniqueConstraint(name = "uk_rent_payment_pi", columnNames = "paymongo_payment_intent_id")
)
@Data
@NoArgsConstructor
public class RentPayment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "paymongo_payment_intent_id", nullable = false, length = 64)
    private String paymongoPaymentIntentId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private User tenant;

    @Column(name = "amount_pesos", nullable = false, precision = 14, scale = 2)
    private BigDecimal amountPesos;

    @Column(nullable = false, length = 8)
    private String currency = "PHP";

    @Column(name = "payment_method_type", length = 32)
    private String paymentMethodType;

    @Column(name = "paymongo_status", nullable = false, length = 48)
    private String paymongoStatus;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt = LocalDateTime.now();
}
