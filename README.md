# Postscript Tag for Google Tag Manager Server-Side

The **Postscript Tag** for Google Tag Manager Server-Side allows sending Subscriber and Event data directly to [Postscript](https://postscript.io/) via their REST API.

This tag supports multiple request types:

- **Track Event**: Send custom event data associated with a subscriber (e.g., purchases, form submissions).
- **Create Subscriber**: Add a new subscriber with optional tags, keyword subscription, and custom properties.
- **Update Subscriber**: Update subscriber data, such as email, tags, and custom fields.

## How to use the Postscript Tag

1. Add the **Postscript Tag** to your server container in GTM.
2. Select the **Type** of request you want to send:
   - `Track Event`
   - `Create Subscriber`
   - `Update Subscriber`
3. Fill in required and optional parameters based on the selected type.
4. Provide your **Private API Key** (found in your Postscript [API Settings](https://app.postscript.io/account/api)).

### Track Event

Send custom events with metadata tied to a subscriber using identifiers like `subscriber_id`, `phone`, or `email`.
> Use fallback option to read Subscriber ID from `ps-id` URLquery parameter, `ps_id` cookie, or from Stape Data Tag Event Data.

- Required:
  - **Event Name**
  - **At least one subscriber identifier**

- Optional:
  - **Event Properties**: Predefined fields like `occurred_at` and `external_id`
  - **Custom Properties**: Additional event metadata

> If no Subscriber is found from identifiers, the event will still be recorded and used later if a match is made.

### Create Subscriber

Adds a new subscriber to Postscript.

- Required:
  - **Phone Number**
  - One of: `Keyword` or `Keyword ID`

- Optional:
  - `Email`, `Origin`, `Shopify Customer ID`
  - Tags
  - Custom Properties

### Update Subscriber

Updates an existing subscriber.

- Required:
  - **Subscriber ID**
  > Use fallback option to read Subscriber ID from `ps-id` URLquery parameter, `ps_id` cookie, or from Stape Data Tag Event Data.

- Optional:
  - `Email`, Tags (additive), Custom Properties

### Additional Options

- **Optimistic Scenario**: Improves performance by firing `gtmOnSuccess()` immediately without waiting for API response.
- **Consent Settings**: Prevent sending data unless ad storage consent is given.
- **Logging Options**: Log to console (during debug or always) or to BigQuery for analytics and debugging.

## Open Source

The **Postscript Tag for GTM Server-Side** is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.