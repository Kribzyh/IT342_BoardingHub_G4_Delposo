package com.boardinghub.repository;

import com.boardinghub.entity.Property;
import com.boardinghub.entity.Room;
import com.boardinghub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomRepository extends JpaRepository<Room, Long> {
    List<Room> findByPropertyOrderByCreatedAtAsc(Property property);
    void deleteByProperty(Property property);
    Optional<Room> findByEnrollmentCode(String enrollmentCode);
    Optional<Room> findByTenant(User tenant);
}
