package com.boardinghub.event;

public record RoomCodeGeneratedEvent(Long roomId, Long propertyId, String code) {
}
