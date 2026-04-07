package com.boardinghub.service;

import com.boardinghub.dto.CreatePropertyRequest;
import com.boardinghub.dto.CreateRoomRequest;
import com.boardinghub.dto.DashboardDtos;
import com.boardinghub.dto.EnrollRequest;
import com.boardinghub.dto.UpdateRoomRequest;
import com.boardinghub.entity.Property;
import com.boardinghub.entity.Room;
import com.boardinghub.entity.User;
import com.boardinghub.repository.PropertyRepository;
import com.boardinghub.repository.RoomRepository;
import com.boardinghub.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class PropertyRoomService {
    private final PropertyRepository propertyRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;

    public List<DashboardDtos.PropertyDto> getLandlordProperties(String email) {
        User landlord = getUserByEmail(email);
        requireRole(landlord, User.Role.LANDLORD);

        return propertyRepository.findByLandlordOrderByCreatedAtDesc(landlord)
                .stream()
                .map(this::toPropertyDto)
                .toList();
    }

    @Transactional
    public DashboardDtos.PropertyDto createProperty(String email, CreatePropertyRequest request) {
        User landlord = getUserByEmail(email);
        requireRole(landlord, User.Role.LANDLORD);

        Property property = new Property();
        property.setName(request.getName().trim());
        property.setAddress(request.getAddress().trim());
        property.setLandlord(landlord);
        return toPropertyDto(propertyRepository.save(property));
    }

    @Transactional
    public DashboardDtos.PropertyDto updateProperty(String email, Long propertyId, CreatePropertyRequest request) {
        Property property = getOwnedProperty(email, propertyId);
        property.setName(request.getName().trim());
        property.setAddress(request.getAddress().trim());
        return toPropertyDto(propertyRepository.save(property));
    }

    @Transactional
    public void deleteProperty(String email, Long propertyId) {
        Property property = getOwnedProperty(email, propertyId);
        roomRepository.deleteByProperty(property);
        propertyRepository.delete(property);
    }

    @Transactional
    public DashboardDtos.RoomDto createRoom(String email, CreateRoomRequest request) {
        Property property = getOwnedProperty(email, request.getPropertyId());

        Room room = new Room();
        room.setProperty(property);
        room.setRoomNumber(request.getRoomNumber().trim());
        room.setMonthlyRate(request.getMonthlyRate());
        room.setStatus(Room.Status.AVAILABLE);
        return toRoomDto(roomRepository.save(room));
    }

    @Transactional
    public DashboardDtos.RoomDto updateRoom(String email, Long roomId, UpdateRoomRequest request) {
        Room room = getOwnedRoom(email, roomId);
        room.setRoomNumber(request.getRoomNumber().trim());
        room.setMonthlyRate(request.getMonthlyRate());
        return toRoomDto(roomRepository.save(room));
    }

    @Transactional
    public void deleteRoom(String email, Long roomId) {
        Room room = getOwnedRoom(email, roomId);
        roomRepository.delete(room);
    }

    @Transactional
    public DashboardDtos.RoomDto generateCode(String email, Long roomId) {
        Room room = getOwnedRoom(email, roomId);
        if (room.getStatus() != Room.Status.AVAILABLE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room is not available");
        }

        String code = String.format("%09d", new Random().nextInt(1_000_000_000));
        room.setEnrollmentCode(code);
        room.setEnrollmentExpiresAt(LocalDateTime.now().plusMinutes(5));
        return toRoomDto(roomRepository.save(room));
    }

    @Transactional
    public DashboardDtos.RentDetailsDto enrollTenant(String email, EnrollRequest request) {
        User tenant = getUserByEmail(email);
        requireRole(tenant, User.Role.TENANT);

        String code = Optional.ofNullable(request.getCode()).orElse("").trim();
        if (!code.matches("\\d{9}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Code must be 9 digits");
        }

        Room room = roomRepository.findByEnrollmentCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid code"));

        if (room.getEnrollmentExpiresAt() == null || room.getEnrollmentExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Code expired");
        }
        if (room.getStatus() != Room.Status.AVAILABLE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room is already occupied");
        }

        room.setTenant(tenant);
        room.setEnrolledAt(LocalDateTime.now());
        room.setStatus(Room.Status.OCCUPIED);
        room.setEnrollmentCode(null);
        room.setEnrollmentExpiresAt(null);
        Room saved = roomRepository.save(room);

        return toRentDetails(saved);
    }

    public DashboardDtos.RentDetailsDto getTenantRentDetails(String email) {
        User tenant = getUserByEmail(email);
        requireRole(tenant, User.Role.TENANT);

        Room room = roomRepository.findByTenant(tenant)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not enrolled"));
        return toRentDetails(room);
    }

    private Property getOwnedProperty(String email, Long propertyId) {
        User landlord = getUserByEmail(email);
        requireRole(landlord, User.Role.LANDLORD);

        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Property not found"));
        if (!property.getLandlord().getId().equals(landlord.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Unauthorized property access");
        }
        return property;
    }

    private Room getOwnedRoom(String email, Long roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found"));
        Property property = getOwnedProperty(email, room.getProperty().getId());
        if (!room.getProperty().getId().equals(property.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Unauthorized room access");
        }
        return room;
    }

    private User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private void requireRole(User user, User.Role expectedRole) {
        if (user.getRole() != expectedRole) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Role not allowed");
        }
    }

    private DashboardDtos.PropertyDto toPropertyDto(Property property) {
        List<DashboardDtos.RoomDto> rooms = roomRepository.findByPropertyOrderByCreatedAtAsc(property)
                .stream()
                .map(this::toRoomDto)
                .toList();
        return new DashboardDtos.PropertyDto(property.getId(), property.getName(), property.getAddress(), rooms);
    }

    private DashboardDtos.RoomDto toRoomDto(Room room) {
        DashboardDtos.TenantDto tenantDto = null;
        if (room.getTenant() != null) {
            tenantDto = new DashboardDtos.TenantDto(
                    room.getTenant().getId(),
                    room.getTenant().getFullName(),
                    room.getTenant().getEmail(),
                    room.getEnrolledAt()
            );
        }
        return new DashboardDtos.RoomDto(
                room.getId(),
                room.getProperty().getId(),
                room.getRoomNumber(),
                room.getMonthlyRate(),
                room.getStatus(),
                room.getEnrollmentCode(),
                room.getEnrollmentExpiresAt(),
                tenantDto
        );
    }

    private DashboardDtos.RentDetailsDto toRentDetails(Room room) {
        return new DashboardDtos.RentDetailsDto(
                room.getProperty().getId(),
                room.getProperty().getName(),
                room.getProperty().getAddress(),
                room.getId(),
                room.getRoomNumber(),
                room.getMonthlyRate(),
                room.getEnrolledAt()
        );
    }
}
