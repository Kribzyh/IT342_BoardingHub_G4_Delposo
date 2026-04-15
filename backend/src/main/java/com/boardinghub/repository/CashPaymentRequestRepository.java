package com.boardinghub.repository;

import com.boardinghub.entity.CashPaymentRequest;
import com.boardinghub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CashPaymentRequestRepository extends JpaRepository<CashPaymentRequest, Long> {

    boolean existsByTenantAndStatus(User tenant, CashPaymentRequest.Status status);

    Optional<CashPaymentRequest> findByTenantAndStatus(User tenant, CashPaymentRequest.Status status);

    @Query("""
            SELECT c FROM CashPaymentRequest c
            JOIN FETCH c.room r
            JOIN FETCH r.property p
            JOIN FETCH p.landlord
            JOIN FETCH c.tenant
            WHERE p.landlord = :landlord AND c.status = :status
            ORDER BY c.submittedAt DESC
            """)
    List<CashPaymentRequest> findAllForLandlordByStatus(
            @Param("landlord") User landlord,
            @Param("status") CashPaymentRequest.Status status
    );

    @Query("""
            SELECT c FROM CashPaymentRequest c
            JOIN FETCH c.room r
            JOIN FETCH r.property p
            JOIN FETCH p.landlord
            JOIN FETCH c.tenant
            WHERE c.id = :id
            """)
    Optional<CashPaymentRequest> findByIdWithRelations(@Param("id") Long id);
}
