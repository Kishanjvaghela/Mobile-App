import { basePath } from "../../config";
import { log } from "../../config-debug";


export function validateObject(sourceData, props, index=-1, path='') {
  let result = '';
  const space = '  ';

	if (sourceData == null) {
		result = `<null_object>;` + space;
	} else if (typeof(sourceData) != 'object') {
		result = `<not_an_object>_${typeof(sourceData)};` + space;
	}
	if (result.length > 0) {
		if (path.length > 0) {
				return `${path}:${result}`;
			} else {
				return result;
			}
	}

  let data = Object.assign({}, sourceData) // create a copy to remove used props thus leave new only
  const na = '__n/a__';

	if (path.length > 0) path += '.';
	
  for (let n in props) {
    const item = (data.hasOwnProperty(n) ? data[n] : na);
    let type1 = props[n];
    let type2 = (item !== null ? typeof(item) : 'null');
    let doDelete = true

		if (typeof(type1) == 'string' && type1.indexOf(',') > 0) {
			const types = type1.split(',')
			if (types.indexOf(type2) > -1) {
				// nothing to do
			} else {
				result += `${path}${n}:not_in_[${type1}]_${type2};` + space;
			}
    } else if (type1 == 'any') {
    	// nothing to do
    } else if ( item == na ) {
      result += `${path}${n}:na_${type2};` + space;
      doDelete = false;
    } else if (typeof(type1) == 'object') {      
      result += validateObject(item, type1, -1, `${n}`);
    } else if (type2 == 'string' && item.length == 0) {
      result += `${path}${n}:empty_str;` + space;
    } else if (type2 == 'number') {
      if (isNaN(item)) result += `${path}${n}:NaN;` + space;
    } else if (type1 != type2) {
      result += `${path}${n}:${type2};` + space;
    }
    
    if (doDelete) {
    	// filtering out checked prop
    	delete data[n];
    }
  }
  
  // checking for new fields in data that are not defined in props
  for (let n in data) {
    const type2 = typeof(data[n]);
    result += `${n}:new_${type2};` + space;  	
	}

  if (result.length > 0) {
    // remove last space
    result = result.substr(0,result.length - space.length)
	  //log('debug-in',`result: ${result} path: '${path}'  indx: ${index}, props: ${Object.keys(props)}`,{data:sourceData,props,path,index,result})
  }


  return result;
}

export function generateSearchString(state, props) {
  let search = `?region=${state.regionId}`;
  search += `&currency=${props.currency}`;
  search += `&startDate=${state.checkInDateFormated}`;
  search += `&endDate=${state.checkOutDateFormated}`;
  search += `&rooms=${state.roomsDummyData}`;
  return search;
}

export function generateWebviewInitialState(params, state = null) {
  if (state) {
    params = {
      ...params,
      ...getWebviewExtraData(state, params)
    };
  }
  const checkInDateFormated = params ? params.checkInDateFormated : "";
  const checkOutDateFormated = params ? params.checkOutDateFormated : "";
  const roomsDummyData = params ? params.roomsDummyData : [];
  const regionId = params ? params.regionId : 0;

  const initialState = {
    ...state,
    guests: params ? params.guests : 0,
    isHotelSelected: params ? params.isHotelSelected : false,
    countryId: params ? params.countryId : 0,
    regionId,
    checkInDateFormated,
    checkOutDateFormated,
    roomsDummyData,
    currency: params.currency,
    email: params ? params.email : "",
    token: params ? params.token : "",
    propertyName: params ? params.propertyName : "",
    message: params ? params.message : "",
    title: params ? params.title : "",
    isHotel: params ? params.isHotel : null,
    canGoBack: false,
    canGoForward: false,
    canGoToResults: false,
    showProgress: true
  };

  const webViewUrl =
    basePath +
    generateWebviewUrl(
      initialState,
      roomsDummyData,
      params && params.baseUrl ? params.baseUrl : null
    );

  initialState.webViewUrl = webViewUrl;

  return initialState;
}

/**
 * @initialState (Object) all needed initial properties (see function body)
 * @baseUrl (String) null if you want to leave it to be automatically generated
 */
export function generateWebviewUrl(initialState, rooms, baseUrl = null) {
  let result = baseUrl;
  const baseHomeUrl = "homes/listings/?";
  const baseHotelUrl = "mobile/hotels/listings?";

  if (initialState.isHotelSelected) {
    // hotels specific properties
    if (!result) result = baseHotelUrl;
    result += "region=" + initialState.regionId;
    result += "&rooms=" + rooms;
  } else {
    // homes specific properties
    if (!result) result = baseHomeUrl;
    result += "countryId=" + initialState.countryId;
    result += "&guests=" + initialState.guests;
  }

  // common properties
  result += "&currency=" + initialState.currency;
  result += "&startDate=" + initialState.checkInDateFormated;
  result += "&endDate=" + initialState.checkOutDateFormated;
  result += "&priceMin=1&priceMax=5000";
  result += "&authEmail=" + initialState.email;
  result += "&authToken=" + initialState.token.replace(" ", "%20");

  return result;
}

export function getWebviewExtraData(state, extraData = {}) {
  return {
    isHotelSelected: state.isHotel,
    guests: state.guests,
    countryId: state.countryId,
    regionId: state.regionId,
    checkOutDateFormated: state.checkOutDateFormated,
    checkInDateFormated: state.checkInDateFormated,
    roomsDummyData: state.roomsDummyData, //encodeURI(JSON.stringify(state.roomsData)),
    email: state.email,
    token: state.token,
    search: state.search,
    ...extraData
  };
}

export function gotoWebview(state, navigation, extraData = {}) {
  navigation.navigate("WebviewScreen", getWebviewExtraData(state, extraData));
}


export function isArray(value) {
  return (value instanceof Array)
}


export function isObject(value) {
  return (typeof(value) == 'object')
}


export function isNumber(value) {
  return (typeof(value) == 'number')
}


export function isString(value) {
  return (typeof(value) == 'string')
}
