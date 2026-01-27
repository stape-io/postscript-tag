const BigQuery = require('BigQuery');
const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getContainerVersion = require('getContainerVersion');
const getCookieValues = require('getCookieValues');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeInteger = require('makeInteger');
const makeString = require('makeString');
const parseUrl = require('parseUrl');
const sendHttpRequest = require('sendHttpRequest');

/*==============================================================================
==============================================================================*/

const traceId = getRequestHeader('trace-id');
const eventData = getAllEventData();
const useOptimisticScenario = isUIFieldTrue(data.useOptimisticScenario);

if (!isConsentGivenOrNotRequired()) {
  return data.gtmOnSuccess();
}

const url = eventData.page_location || getRequestHeader('referer');
if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
  return data.gtmOnSuccess();
}

const actionHandlers = {
  trackEvent: handleEvent,
  createSubscriber: handleCreateSubscriber,
  updateSubscriber: handleUpdateSubscriber
};

const handler = actionHandlers[data.type];
if (handler) {
  handler(data, eventData);
} else {
  return data.gtmOnFailure();
}

if (useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function handleEvent(data, eventData) {
  const requestData = {
    type: data.eventName,
    properties: {}
  };

  const userSubscriberId = getUserSubscriberId(data, eventData);
  if (userSubscriberId) requestData.subscriber_id = userSubscriberId;

  const userPhoneNumber = data.userPhone;
  if (userPhoneNumber) requestData.phone = makeString(userPhoneNumber);

  const userEmailAddress = data.userEmail;
  if (userEmailAddress) requestData.email = userEmailAddress;

  if (data.eventPropertiesList) {
    data.eventPropertiesList.forEach((d) => (requestData[d.name] = d.value));
  }

  if (data.eventCustomPropertiesObject) {
    mergeObj(requestData.properties, data.eventCustomPropertiesObject);
  }
  if (data.eventCustomPropertiesList) {
    data.eventCustomPropertiesList.forEach((d) => (requestData.properties[d.name] = d.value));
  }

  return sendRequest(data, {
    path: '/events',
    body: requestData
  });
}

function handleCreateSubscriber(data, eventData) {
  const requestData = {
    phone_number: makeString(data.userPhone)
  };

  if (data.keyword) requestData.keyword = makeString(data.keyword);
  if (data.keywordId) requestData.keyword_id = makeString(data.keywordId);
  if (data.origin) requestData.origin = makeString(data.origin);

  const userEmailAddress = data.userEmail;
  if (userEmailAddress) requestData.email = userEmailAddress;

  if (data.userShopifyCustomerId) {
    requestData.shopify_customer_id = makeInteger(data.userShopifyCustomerId);
  }

  const userTags = getUserTags(data);
  if (userTags && userTags.length) requestData.tags = userTags;

  requestData.properties = getUserCustomProperties(data);

  return sendRequest(data, {
    path: '/subscribers',
    body: requestData
  });
}

function handleUpdateSubscriber(data, eventData) {
  const requestData = {};

  const userSubscriberId = getUserSubscriberId(data, eventData);
  if (!userSubscriberId) {
    log({
      Name: 'Postscript',
      Type: 'Message',
      TraceId: traceId,
      EventName: data.type,
      Message: 'Request was not sent.',
      Reason: 'Missing Subscriber ID.'
    });

    return data.gtmOnFailure();
  }

  const userEmailAddress = data.userEmail;
  if (userEmailAddress) requestData.email = userEmailAddress;

  const userTags = getUserTags(data);
  if (userTags && userTags.length) requestData.tags = userTags;

  requestData.properties = getUserCustomProperties(data);

  return sendRequest(data, {
    path: '/subscribers/' + encodeUriComponent(userSubscriberId),
    body: requestData
  });
}

function getUserTags(data) {
  if (!data.userTags) return;

  let userTags = [];
  data.userTags.forEach((d) => {
    if (!d.value) return;
    const tag = makeString(d.value)
      .split(',')
      .map((t) => t.trim());
    userTags = userTags.concat(tag);
  });

  return userTags;
}

function getUserCustomProperties(data) {
  const userCustomProperties = {};

  if (data.userCustomPropertiesObject) {
    mergeObj(userCustomProperties, data.userCustomPropertiesObject);
  }
  if (data.userCustomPropertiesList) {
    data.userCustomPropertiesList.forEach((d) => (userCustomProperties[d.name] = d.value));
  }

  return userCustomProperties;
}

function getUserSubscriberId(data, eventData) {
  if (data.userSubscriberId) return makeString(data.userSubscriberId);

  if (isUIFieldTrue(data.useFallbackSubscriberId)) {
    const url = eventData.page_location || getRequestHeader('referer');
    const subscriberIdFromURL = url ? parseUrl(url).searchParams['ps-id'] : undefined;
    const subscriberIdFromCookie = getCookieValues('ps_id')[0];
    const subscriberIdFromCommonCookie = (eventData.common_cookie || {}).ps_id;

    return subscriberIdFromURL || subscriberIdFromCookie || subscriberIdFromCommonCookie;
  }
}

function sendRequest(data, requestData) {
  const requestUrl = 'https://api.postscript.io/api/v2' + requestData.path;
  const requestMethod = generateRequestMethod(data);
  const requestBody = requestData.body;

  log({
    Name: 'Postscript',
    Type: 'Request',
    TraceId: traceId,
    EventName: data.type,
    RequestMethod: requestMethod,
    RequestUrl: requestUrl,
    RequestBody: requestBody
  });

  return sendHttpRequest(
    requestUrl,
    (statusCode, headers, body) => {
      log({
        Name: 'Postscript',
        Type: 'Response',
        TraceId: traceId,
        EventName: data.type,
        ResponseStatusCode: statusCode,
        ResponseHeaders: headers,
        ResponseBody: body
      });

      if (!useOptimisticScenario) {
        if (statusCode >= 200 && statusCode < 400) {
          data.gtmOnSuccess();
        } else {
          data.gtmOnFailure();
        }
      }
    },
    {
      headers: generateRequestHeaders(data),
      method: requestMethod
    },
    requestBody ? JSON.stringify(requestBody) : undefined
  );
}

function generateRequestHeaders(data) {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + data.apiKey
  };
}

function generateRequestMethod(data) {
  const typeToRequestPath = {
    trackEvent: 'POST',
    createSubscriber: 'POST',
    updateSubscriber: 'PATCH'
  };

  return typeToRequestPath[data.type];
}

/*==============================================================================
  Helpers
==============================================================================*/

function mergeObj(target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) target[key] = source[key];
  }
  return target;
}

function isHashed(value) {
  if (!value) return false;
  return makeString(value).match('^[A-Fa-f0-9]{64}$') !== null;
}

function isUIFieldTrue(field) {
  return [true, 'true'].indexOf(field) !== -1;
}

function isConsentGivenOrNotRequired() {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}

function log(rawDataToLog) {
  const logDestinationsHandlers = {};
  if (determinateIsLoggingEnabled()) logDestinationsHandlers.console = logConsole;
  if (determinateIsLoggingEnabledForBigQuery()) logDestinationsHandlers.bigQuery = logToBigQuery;

  const keyMappings = {
    // No transformation for Console is needed.
    bigQuery: {
      Name: 'tag_name',
      Type: 'type',
      TraceId: 'trace_id',
      EventName: 'event_name',
      RequestMethod: 'request_method',
      RequestUrl: 'request_url',
      RequestBody: 'request_body',
      ResponseStatusCode: 'response_status_code',
      ResponseHeaders: 'response_headers',
      ResponseBody: 'response_body'
    }
  };

  for (const logDestination in logDestinationsHandlers) {
    const handler = logDestinationsHandlers[logDestination];
    if (!handler) continue;

    const mapping = keyMappings[logDestination];
    const dataToLog = mapping ? {} : rawDataToLog;

    if (mapping) {
      for (const key in rawDataToLog) {
        const mappedKey = mapping[key] || key;
        dataToLog[mappedKey] = rawDataToLog[key];
      }
    }

    handler(dataToLog);
  }
}

function logConsole(dataToLog) {
  logToConsole(JSON.stringify(dataToLog));
}

function logToBigQuery(dataToLog) {
  const connectionInfo = {
    projectId: data.logBigQueryProjectId,
    datasetId: data.logBigQueryDatasetId,
    tableId: data.logBigQueryTableId
  };

  dataToLog.timestamp = getTimestampMillis();

  ['request_body', 'response_headers', 'response_body'].forEach((p) => {
    dataToLog[p] = JSON.stringify(dataToLog[p]);
  });

  const bigquery =
    getType(BigQuery) === 'function' ? BigQuery() /* Only during Unit Tests */ : BigQuery;
  bigquery.insert(connectionInfo, [dataToLog], { ignoreUnknownValues: true });
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}

function determinateIsLoggingEnabledForBigQuery() {
  if (data.bigQueryLogType === 'no') return false;
  return data.bigQueryLogType === 'always';
}
