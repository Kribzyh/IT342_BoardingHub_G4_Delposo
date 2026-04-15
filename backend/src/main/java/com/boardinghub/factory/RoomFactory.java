package com.boardinghub.factory;

import com.boardinghub.dto.CreateRoomRequest;
import com.boardinghub.entity.Property;
import com.boardinghub.entity.Room;
import org.springframework.stereotype.Component;

@Component
public class RoomFactory {
    public Room create(Property property, CreateRoomRequest request) {
        Room room = new Room();
        room.setProperty(property);
        room.setRoomNumber(request.getRoomNumber().trim());
        room.setMonthlyRate(request.getMonthlyRate());
        room.setStatus(Room.Status.AVAILABLE);
        return room;
    }
}
