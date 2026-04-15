package com.boardinghub.factory;

import com.boardinghub.dto.CreatePropertyRequest;
import com.boardinghub.entity.Property;
import com.boardinghub.entity.User;
import org.springframework.stereotype.Component;

@Component
public class PropertyFactory {
    public Property create(User landlord, CreatePropertyRequest request) {
        Property property = new Property();
        property.setName(request.getName().trim());
        property.setAddress(request.getAddress().trim());
        property.setLandlord(landlord);
        return property;
    }
}
