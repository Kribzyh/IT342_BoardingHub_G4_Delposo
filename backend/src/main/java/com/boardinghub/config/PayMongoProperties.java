package com.boardinghub.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "paymongo")
public class PayMongoProperties {
    /**
     * Secret API key (sk_test_... or sk_live_...). Never expose to the browser.
     */
    private String secretKey = "";
    private String apiBase = "https://api.paymongo.com/v1";
    /** Shown on the customer's statement / receipt (keep short). */
    private String statementDescriptor = "BoardingHub";
    /** Used when the client does not send returnUrl (must be an absolute URL). */
    private String defaultReturnUrl = "http://localhost:3000/dashboard?payment=complete";
}
