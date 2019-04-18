import React, { Component } from "react";
import { SafeAreaView, WebView } from "react-native";
import { connect } from "react-redux";
import { bindActionCreators } from "redux";
import {
  TouchableOpacity,
  View,
  Platform,
  NativeModules,
  DeviceEventEmitter,
  Dimensions,
  Text
} from "react-native";

import FontAwesome, { Icons } from "react-native-fontawesome";

import {
  imgHost,
  socketHost,
  HOTELS_SOCKET_CONNECTION_TIMEOUT,
  HOTELS_STATIC_CONNECTION_TIMEOUT,
  HOTELS_SOCKET_CONNECTION_UPDATE_TICK
} from "../../../../config";
import SearchBar from "../../../molecules/SearchBar";
import LTLoader from "../../../molecules/LTLoader";
import DateAndGuestPicker from "../../../organisms/DateAndGuestPicker";
import HotelItemView from "../../../organisms/HotelItemView";
import requester from "../../../../initDependencies";

import UUIDGenerator from "react-native-uuid-generator";
import _ from "lodash";
import moment from "moment";

import { UltimateListView } from "react-native-ultimate-listview";
import { DotIndicator } from "react-native-indicators";
import MapModeHotelsSearch from "../MapModeHotelsSearch";
import { WebsocketClient } from "../../../../utils/exchangerWebsocket";
import lang from "../../../../language";

import styles from "./styles";
import {
  createHotelSearchInitialState,
  generateWebviewInitialState,
  generateSearchString,
  generateFilterInitialData,
  generateHotelFilterString,
  updateHotelsFromFilters,
  updateHotelIdsMap,
  updateHotelsFromSocketCache,
  parseAndCacheHotelDataFromSocket,
  DISPLAY_MODE_NONE,
  DISPLAY_MODE_SEARCHING,
  DISPLAY_MODE_RESULTS_AS_LIST,
  DISPLAY_MODE_RESULTS_AS_MAP,
  DISPLAY_MODE_HOTEL_DETAILS,
  hasValidCoordinatesForMap
} from "../../utils";
import stomp from "stomp-websocket-js";
import { isNative } from "../../../../version";
import { setIsApplyingFilter } from '../../../../redux/action/userInterface'

const { width, height } = Dimensions.get("window");

let stompiOSClient = undefined;
let stompAndroidClient = undefined;

//TODO: remove this @@debug START
const debug = () => {
  return require("moment")().format("hh:mm:ss");
};
// setInterval(()=>//console.log(`### [${debug()}] stompiOSClient/stompAndroidClient`,stompiOSClient,stompAndroidClient),300)
//TODO: remove this @@debug END

class HotelsSearchScreen extends Component {
  constructor(props) {
    super(props);
    console.log("#hotel-search# 2.1/6  HotelSearchScreen constructor START");
    console.disableYellowBox = true;

    const { params } = this.props.navigation.state; //eslint-disable-line
    this.state = createHotelSearchInitialState(params);

    this.pageLimit = 10;
    this.isFirstLoad = true;
    this.isSocketDown = true;
    this.validSocketPrices = 0;
    this.staticDataReceived = false;
    this.lastSocketUpdateTime = 0;
    this.hotelsIndicesByIdMap = null; // see getStaticHotelsData() for populating this one
    this.hotelsSocketCacheMap = {}; // cache for hotels from socket, that are not present on screen (were not fetched by scrolling down the list)
    this.hotelsSocketCacheCount = 0; // cache for hotels from socket, that are not present on screen (were not fetched by scrolling down the list)
    this.socketPriceMin = 5000;
    this.socketPriceMax = 0;

    this.listViewHelpers = {}; // startFetch & abortFetch (see UltimateListView docs - react-native-ultimate-listview)
    this.webViewRef = null;

    this.socketTimeoutId = -1;
    this.staticTimeoutId = -1;

    // Bind functions to this,
    // thus optimizing performance - by using bind(this) instead of "=> function".
    this.gotoHotelDetailsPageByMap = this.gotoHotelDetailsPageByMap.bind(this);
    this.saveState = this.saveState.bind(this);
    this.unsubscribe = this.stopSocketConnection.bind(this);
    this.renderListItem = this.renderListItem.bind(this);
    this.renderFooter = this.renderFooter.bind(this);
    this.onDataFromSocket = this.onDataFromSocket.bind(this);
    this.onStaticData = this.onStaticData.bind(this);
    this.onFilteredData = this.onFilteredData.bind(this);
    this.onFetchNewListViewData = this.onFetchNewListViewData.bind(this);
    this.onToggleMapOrListResultsView = this.onToggleMapOrListResultsView.bind(this);
    this.onUpdateHotelsInfo = this.onUpdateHotelsInfo.bind(this);

    //TODO: @@debug - remove
    console.log("#hotel-search# 2.2/6 HotelSearchScreen constructor END");
    this.renderTimes = 0;
    this.renderItemTimes = 0;
  }

  componentDidMount() {
    console.log("#hotel-search# 3/6 HotelSearchScreen componentDidMount START");

    this.startStaticDataConnectionTimeOut();
    this.startSocketDataConnectionTimeOut();

    if (this.state.isHotel) {
      this.getStaticHotelsData();
    }

    // TODO: Figure out why is this call used
    // It was initially called from the constructor body (why? how is it possible to work)
    this.saveState();
  }

  componentWillUnmount() {
    this.isSocketDown = true;
    this.stopSocketConnection();
  }

  startSocketDataConnectionTimeOut() {
    console.tron.logImportant('Starting Socket connection timeout', {ala:'bala'})

    const _this = this;
    const funcSocketTimeout = function() {
      if (_this.validSocketPrices == 0) {
        _this.setState({ isSocketTimeout: true });
      }
      console.tron.logImportant(`Socket connection timeout DONE, valid socket prices: ${_this.validSocketPrices}`)
    };
    this.setState({ isSocketTimeout: false });

    if (this.socketTimeoutId > -1) {
      clearTimeout(this.socketTimeoutId);
      this.socketTimeoutId = -1;
    }
    this.socketTimeoutId = setTimeout(
      funcSocketTimeout,
      1000 * HOTELS_SOCKET_CONNECTION_TIMEOUT
    );
  }

  startStaticDataConnectionTimeOut() {
    const _this = this;
    const funcStaticHotelsTimeout = function() {
      if (!_this.staticDataReceived) {
        _this.setState({ isStaticTimeout: true });
      }
    };

    this.staticDataReceived = false;
    this.setState({ isStaticTimeout: false });

    if (this.staticTimeoutId > -1) {
      clearTimeout(this.staticTimeoutId);
      this.staticTimeoutId = -1;
    }
    this.staticTimeoutId = setTimeout(
      funcStaticHotelsTimeout,
      1000 * HOTELS_STATIC_CONNECTION_TIMEOUT
    );
  }

  getStaticHotelsData() {
    console.log("#hotel-search# 4.1/6 [HotelsSearchScreen] getStaticHotelsData");

    this.hotelsIndicesByIdMap = {};
    const _this = this;

    this.setState(
      // change state function
      function(prevState, updatedProps) {
        //console.log('SET_STATE 1', {prevState,updatedProps})
        return {
          displayMode: DISPLAY_MODE_SEARCHING,
          hotelsInfo: [],
          allElements: false,
          editable: false
        };
      },

      // callback (after change state above)
      function() {
        //console.log('SET_STATE 2', {_th:this});
        _this.startStaticDataConnectionTimeOut();
        requester
          .getStaticHotels(_this.state.regionId)
          .then(_this.onStaticData);
      }
    );
    //console.log("#hotel-search# 4.2/6 [HotelsSearchScreen] getStaticHotelsData");
  }

  // TODO: Inspect this flow - and create a component to implement it
  async startSocketConnection() {
    this.isSocketDown = false;

    this.uuid = await UUIDGenerator.getRandomUUID();

    // common code
    WebsocketClient.startGrouping();

    if (Platform.OS === "ios") {
      this.stompiOSConnect();
    } else if (Platform.OS === "android") {
      this.stompAndroidConnect();
    }
  }

  // TODO: Inspect this flow - and create a component to implement it
  stopSocketConnection(removeListeners = true) {
    // common code
    if (removeListeners) {
      WebsocketClient.stopGrouping();
      this.isSocketDown = true;
    }

    // platform specific
    if (Platform.OS === "ios") {
      // TODO: Figure out why this is null sometimes
      if (stompiOSClient) {
        stompiOSClient.disconnect();
      }
    } else if (Platform.OS === "android") {
      if (removeListeners) {
        DeviceEventEmitter.removeAllListeners("onStompConnect");
        DeviceEventEmitter.removeAllListeners("onStompError");
        DeviceEventEmitter.removeAllListeners("onStompMessage");
      }

      if (stompAndroidClient) {
        stompAndroidClient.close();
      }
    }

    // stompAndroidClient = null;
    // stompiOSClient = null;
  }

  stompiOSConnect() {
    //console.log("stompiOSConnect ---------------");

    stompiOSClient = stomp.client(socketHost);
    stompiOSClient.debug = null;
    stompiOSClient.connect(
      {},
      frame => {
        var headers = { "content-length": false };
        stompiOSClient.subscribe(`search/${this.uuid}`, this.onDataFromSocket);
        stompiOSClient.send(
          "search",
          headers,
          JSON.stringify({ uuid: this.uuid, query: this.searchString })
        );
      },
      error => {
        stompiOSClient.disconnect();
        this.setState({ isLoading: false });
      }
    );
  }

  stompAndroidConnect() {
    stompAndroidClient = NativeModules.StompModule;

    //console.log("stompAndroid -------------");
    //console.log("stompAndroid---------------", this.uuid, this.searchString);
    const message =
      '{"uuid":"' + this.uuid + '","query":"' + this.searchString + '"}';
    const destination = "search/" + this.uuid;

    DeviceEventEmitter.removeAllListeners("onStompConnect");
    DeviceEventEmitter.addListener("onStompConnect", () => {
      //console.log("onStompConnect -------------");
    });

    DeviceEventEmitter.removeAllListeners("onStompError");
    DeviceEventEmitter.addListener("onStompError", ({ type, message }) => {
      //console.log("onStompError -------------", type, message);
    });

    DeviceEventEmitter.removeAllListeners("onStompMessage");
    DeviceEventEmitter.addListener("onStompMessage", ({ message }) => {
      // console.warn('stomp message', message);
      // TODO: (low priority) Solve this difference between iOS and Android
      return this.onDataFromSocket({ body: message });
    });

    stompAndroidClient.getData(message, destination);
  }

  onDataFromSocket(data) {
    this.initResultViews();

    const { body } = data;
    // try {
    const parsedData = JSON.parse(body);

    /*             
            console.debug("#hotel-search# [HotelsSearchScreen] stomp - onDataFromSocket ---", 
                {body,data,parsedData,_th: this}
            );
 */
    // restart timeout (thus also clean red styling of footer)
    if (this.state.isSocketTimeout) {
      this.startSocketDataConnectionTimeOut();
    }

    if (parsedData.hasOwnProperty("allElements")) {
      // TODO: @@debug - remove
      // console.warn(`#hotel-search# [HotelsSearchScreen] onDataFromSocket, DONE`, parsedData);

      if (parsedData.allElements) {
        this.setState({
          allElements: true,
          editable: true,
          pricesFromSocketValid: this.validSocketPrices
        });
        this.onDoneSocket(parsedData);
      }
    } else {
      let hotelData = parsedData;

      if (hotelData.price != null) {
        if (this.socketPriceMax < hotelData.price) {
          this.socketPriceMax = hotelData.price;
        }
        if (this.socketPriceMin > hotelData.price) {
          this.socketPriceMin = hotelData.price;
        }
      }

      // TODO: @@debug - remove
      // console.warn(`#hotel-search# [HotelsSearchScreen] onDataFromSocket, id:${hotelData.id} name:${hotelData.name}, pic:${hotelData.hotelPhoto}, price:${hotelData.price}`);

      //TODO: @@debug remove
      let index = this.hotelsIndicesByIdMap[hotelData.id];
      if (index && index < 7 && index > 0) {
        console.log(
          `#hotel-search# [HotelsSearchScreen] onDataFromSocket, index: ${index} id:${
            hotelData.id
          } name:${hotelData.name}, pic:${hotelData.hotelPhoto}, price:${
            hotelData.price
          }`,
          "font-weight: bold"
        );
      }

      this.setState(
        // change state function
        function(prevState, updatedProps) {
          let result = prevState;

          if (!this.socketDown) { // don't update if socket is not connected any more
            if (hotelData.price && !isNaN(hotelData.price)) {
              // update socket prices loaded in footer
              this.validSocketPrices++;
              const initialCoord = parseAndCacheHotelDataFromSocket(hotelData,this.hotelsSocketCacheMap,this.hotelsIndicesByIdMap,result.hotelsInfo,index);
              if (prevState.initialLat == null && prevState.initialLon == null) {
                Object.assign(result, initialCoord);
              }

              // At intervals of HOTELS_SOCKET_CONNECTION_UPDATE_TICK seconds
              // refresh prices in footer and list prices loaded so far:
              const currentTime = new Date().getTime();
              const limitTime = this.lastSocketUpdateTime + HOTELS_SOCKET_CONNECTION_UPDATE_TICK * 1000;
              if (!this.lastSocketUpdateTime || limitTime < currentTime) {
                // refresh prices footer
                result.pricesFromSocketValid = this.validSocketPrices;
                this.lastSocketUpdateTime = currentTime;

                // update hotels data, setState(hotelsInfo)/setRows
                if (prevState.hotelsInfo.length > 0) {
                  Object.assign(result, this.onUpdateHotelsInfo(prevState));
                }
              }
            }
          }
          return result;
        },
        // callback (after change state above)
        function() {
          // Checking if this is HotelsSearchScreen
          // console.log(`#hotel-search# [HotelsSearchScreen::onDataFromSocket -> setState::callback] this instanceof isHotelSearchScreen: ${this instanceof HotelsSearchScreen}`);

          if (
            this.state.displayMode === DISPLAY_MODE_RESULTS_AS_MAP &&
            this.mapView != null &&
            this.state.hotelsInfo.length % 20 === 0
          ) {
            this.mapView.refresh(this.state.hotelsInfo);
          }
        }
      );
    }
    // } catch (e) {
    // console.error("ERROR on socket Message", {message, e});
    // Error
    // }
  }

  onDoneSocket = data => {
    console.log( `#hotel-search# [HotelsSearchScreen] onDoneSocket, totalElements: ${data.totalElements}`);

    this.stopSocketConnection(false);

    if (this.pageLimit > data.totalElements) {
      this.listSetPageLimit(data.totalElements);
    }
    this.setState((prevState) => ({
        ...this.onUpdateHotelsInfo(prevState),
        pricesFromSocket: data.totalElements,
        priceRange: [this.priceMin, this.priceMax]
      }),
      () => {
        this.setState({ isDoneSocket: true });
        // this.updateFilter(generateFilterInitialData());
      }
    );
  };

  onBackButtonPress = () => {
    switch (this.state.displayMode) {
      case DISPLAY_MODE_HOTEL_DETAILS:
        this.setState({ displayMode: DISPLAY_MODE_RESULTS_AS_LIST });
        break;

      default:
        this.props.navigation.goBack();
        break;
    }
  };

  onToggleMapOrListResultsView() {
    const displayMode =
      this.state.displayMode == DISPLAY_MODE_RESULTS_AS_LIST
        ? DISPLAY_MODE_RESULTS_AS_MAP
        : DISPLAY_MODE_RESULTS_AS_LIST;

    // this.isFirstLoad = true;
    //console.log(`[HotelsSearchScreen] displayMode: ${this.state.displayMode}`)

    // prevent button from staying semi-transparent
    const func = () => this.setState({ displayMode });
    setTimeout(func, 300);
  }

  gotoHotelDetailsPageByList = (item, state, extraParams) => {
    //@@debug
    if (state && extraParams) {
      // webview inside
      let initialState = generateWebviewInitialState(extraParams, state);

      /*console.log(`[HotelsSearchScreen] Loading hotel info`, {
        initialState,
        extraParams,
        item,
        state
      });*/

      this.setState({
        isLoading: true,
        webViewUrl: initialState.webViewUrl,
        displayMode: DISPLAY_MODE_HOTEL_DETAILS
      });
    } else {
      //console.log("gotoHotelDetailsPage", item, this.searchString.substring(1), this.searchString.substring(1).split('&'));

      this.setState({ isLoading: true });
      requester
        .getHotelById(item.id, this.searchString.split("&"))
        .then(res => {
          //console.log("requester.getHotelById", res);
          // here you set the response in to json
          res.body
            .then(data => {
              console.log("requester.getHotelById data", data);
              const hotelPhotos = [];
              for (let i = 0; i < data.hotelPhotos.length; i++) {
                hotelPhotos.push({ uri: imgHost + data.hotelPhotos[i].url });
              }
              this.setState({ isLoading: false });
              this.props.navigation.navigate("HotelDetails", {
                guests: this.state.guests,
                hotelDetail: item,
                searchString: this.searchString,
                hotelFullDetails: data,
                dataSourcePreview: hotelPhotos,
                daysDifference: this.state.daysDifference
              });
            })
            .catch(err => {
              //console.log(err);
            });
        });
    }
  };

  /**
   * @hotelsFromServer used when isSocket is false
   * This is called in several cases when hotelsInfo data is updated:
   * (1) on socket data
   * (2) on done socket
   * (3) on filtered data - this is when isSocket is false and hotelsFromServer is populated
   */
  onUpdateHotelsInfo(prevState, isSocket = true, hotelsFromServer = null) {
    let result = null;
    let hotelsFresh = null;
    let hotelsForMap = null;
    let coordinates = null;
    let extraData = {};

    if (isSocket) {
      const {
        hotelsInfoFresh,hotelsInfoForMapFresh
      } = updateHotelsFromSocketCache(prevState,this.hotelsSocketCacheMap,this.hotelsIndicesByIdMap);
      hotelsFresh = hotelsInfoFresh;
      hotelsForMap = hotelsInfoForMapFresh;
    } else {
      const {
        hotelsFromFilters, indicesById, socketCache, initialCordinates
      } = updateHotelsFromFilters(hotelsFromServer, this.state.hotelsInfo, this.hotelsIndicesByIdMap);

      hotelsFresh = hotelsFromFilters;
      hotelsForMap = hotelsFromFilters;
      coordinates = initialCordinates;
      this.hotelsIndicesByIdMap = indicesById;
      this.hotelsSocketCacheMap = socketCache;
      const filteredHotelsCount = hotelsFromFilters.length;
      this.hotelsSocketCacheCount = filteredHotelsCount;
      this.validSocketPrices = filteredHotelsCount;
      extraData = {
        totalHotels: filteredHotelsCount,
        hotelsLoadedInList: filteredHotelsCount,
        pricesFromSocket: filteredHotelsCount
      }
    }

    this.listUpdateDataSource(hotelsFresh);

    result = {
      hotelsInfo: hotelsFresh,
      hotelsInfoForMap: hotelsForMap,
      initialCordinates: coordinates,
      ...extraData
    };

    return result;
  }

  gotoHotelDetailsPageByMap(item) {
    //console.log("gotoHotelDetailsPageByMap", item);

    this.setState({ isLoading: true });
    requester.getHotelById(item.id, this.searchString.split("&")).then(res => {
      // here you set the response in to json
      res.body
        .then(data => {
          const hotelPhotos = [];
          for (let i = 0; i < data.hotelPhotos.length; i++) {
            hotelPhotos.push({ uri: imgHost + data.hotelPhotos[i].url });
          }
          this.setState({ isLoading: false });
          this.props.navigation.navigate("HotelDetails", {
            guests: this.state.guests,
            hotelDetail: item,
            searchString: this.searchString,
            hotelFullDetails: data,
            dataSourcePreview: hotelPhotos,
            daysDifference: this.state.daysDifference
          });
        })
        .catch(err => {
          //console.log(err);
        });
    });
  }

  onFilteredData(res) {
    if (res.success) {
      res.body.then((data) => {
        // not used so far
        // const isCacheExpired = data.isCacheExpired;

        this.setState((prevState) => {
          const newState = this.onUpdateHotelsInfo(prevState, false, data.content)
          return newState;
        }, () => {
          if (this.pageLimit > data.totalElements) {
            this.listSetPageLimit(data.totalElements);
          }
          this.props.setIsApplyingFilter(false);      
        })
      });
    } else {
      // //console.log('Search expired');
    }
  }

  onStaticData(res) {
    const _this = this;
    //console.log(` RESULT: ${res.success} `, {res})

    if (res.success) {
      this.staticDataReceived = true;

      res.body.then(function(data) {
        let hotels = data.content;
        // add index
        // hotels = hotels.map((item,index) => {item.index = index; return item;})

        if (_this.isFirstLoad) {
          _this.isFirstLoad = false;
          if (_this.isSocketDown) {
            _this.startSocketConnection();
          }
        } else { // avoid two calls on first load
          const prevState = {hotelsInfo:hotels, hotelsInfoForMap:[]}
          let {hotelsInfoFresh} = updateHotelsFromSocketCache(prevState, _this.hotelsSocketCacheMap, _this.hotelsIndicesByIdMap);
          hotels = hotelsInfoFresh;
        }

        //TODO: @@debug
        /** console.log START *
                // console.log("#hotel-search# [HotelsSearchScreen]  STATIC DATA", data);
                console.log("#hotel-search# [HotelsSearchScreen] STATIC DATA " +
                    `first: ${data.first}, last: ${data.last}, number: ${data.number},`+
                    ` totalElements: ${data.totalElements}, totalPages: ${data.totalPages},` +
                    ` pageLimit for list: ${_this.pageLimit}`
                );
                console.log('#hotel-search# [HotelsSearchScreen] STATIC DATA, Hotels:');
                for (let i=0; i<hotels.length; i++) {
                    let item = hotels[i];
                    debugHotelData(item, _this.state.hotelsInfo, i, '.. STATIC DATA ..')
                }
                /* console.log END */

        _this.setState(
          prevState => {
            //TODO: @@debug - remove/comment - log state of hotels
            // console.warn(`%c### prevState hotels length: ${prevState.hotelsInfo.length}`, 'font-weight:bold');
            // console.log(`### hotels old/fresh`, {old:prevState.hotelsInfo, new: hotels});

            // filter repeating hotels out
            let newHotels = [];

            hotels.forEach(element => {
              if (_this.hotelsIndicesByIdMap[element.id] != null) {
                //TODO: @@debug - remove
                // console.log(`%c${element.name.padEnd(45, ' ')}%c: ${_this.hotelsIndicesByIdMap[element.id]}, id: ${element.id}`,"color: red; font-weight: bold","color: black; font-weight: normal");
              } else {
                newHotels.push(element);
                //TODO: @@debug - remove
                // console.log(`'%c${element.name.padEnd(45, ' ')}',%c id:  ${element.id} is NEW`,"color: green","color: black");
              }
            });

            updateHotelIdsMap(_this.hotelsIndicesByIdMap, hotels);

            // create a copy, add new data
            const hotelsInfoFresh = prevState.hotelsInfo.concat(newHotels);
            // console.warn(`%c### next hotels length: ${freshList.length}`, 'font-weight: bold');

            const hotelsLoadedInList = hotelsInfoFresh.length;

            if (_this.pageLimit < data.totalElements) {
              _this.listSetPageLimit(data.totalElements);
            }

            // update hotels data, setState(hotelsInfo)
            return {
              displayMode:
                prevState.displayMode == DISPLAY_MODE_SEARCHING
                  ? DISPLAY_MODE_RESULTS_AS_LIST
                  : prevState.displayMode,
              hotelsLoadedInList,
              hotelsInfo: hotelsInfoFresh,
              totalHotels: data.totalElements
            };
          },
          function() {
            if (_this.listViewRef) console.log(`[HotelsScreenSearch] onStaticData - setState calback, rows=${_this.listViewRef.getRows().length}`);

            _this.listStartFetch(hotels, _this.pageLimit);
            if (_this.state.hotelsLoadedInList < 30) {
              _this.setState({ isLoading: false });
            }
          }
        );
      });
    } else {
      console.error(
        "[HotelsSearchScreen] Could not fetch Static Data for hotels"
      );
      this.listStartFetch([], 0);
    }
  }

  listAbortFetch() {
    this.listViewHelpers.abortFetch();
  }

  listStartFetch(dataArray, pageLimit) {
    console.tron.log(`[HotelsSearchScreen] listStartFetch, data: ${dataArray.length}, pageLimit: ${pageLimit}`);    
    this.listViewHelpers.startFetch(dataArray, pageLimit)
  }

  listUpdateDataSource(data) {
    console.tron.log(`[HotelsSearchScreen] listUpdateDataSource, items: ${data ? data.length : 'n/a'}`, {state:this.state, props:this.props});
    this.listViewRef.updateDataSource(data)
  }

  listSetPageLimit(value) {
    console.tron.log(`[HotelsSearchScreen] listSetPageLimit, value: ${value}`);    
    this.pageLimit = value;
  }

  initResultViews() {
    if (
      this.state.displayMode == DISPLAY_MODE_SEARCHING &&
      this.state.hotelsLoadedInList > 0
    ) {
      this.setState({
        displayMode: DISPLAY_MODE_RESULTS_AS_LIST
      });
    }
  }

  // onFetch (page = 1, startFetch, abortFetch) {
  onFetchNewListViewData(page = 1, startFetch, abortFetch) {
    /*console.log(
      `#hotel-search# [HotelsSearchScreen] onFetch / onRefreshResultsOnListView, page:${page}`
    );*/

    if (this.state.isFilterResult) {
      // TODO: Figure this out - how to load results after isDoneSocket
      // (1) For WebApp after isDoneSocket results are shown page by page
      // (2) For MobileApp I suggest it loads all results all the time
      //     After isDone Socket
      return;
    }


    // This is required to determinate whether the first loading list is all loaded.

    this.listViewHelpers = { startFetch, abortFetch };
    
    if (this.isFirstLoad && this.state.hotelsInfo.length == 0) {
      // don't fetch if real first load (not refreshing)
      // this.isFirstLoad = false;
    } else {
      try {
        //console.log("### onFetch 0");
        this.startStaticDataConnectionTimeOut();

        if (this.state.isFilterResult) {
          //console.log("### onFetch 2.1");
          const strSearch = this.generateSearchString(this.state, this.props);
          const strFilters = generateHotelFilterString(
            this.listViewRef.getPage()
          );
          requester
            .getLastSearchHotelResultsByFilter(strSearch, strFilters)
            .then(this.onStaticData);
        } else {
          //console.log("### onFetch 1.1");
          requester
            .getStaticHotels(this.state.regionId, page - 1)
            .then(this.onStaticData);
        }
      } catch (err) {
        //console.log("### onFetch Error", err);
        //console.log("onFetch--=- error  ", err);
        this.listAbortFetch(); // manually stop the refresh or pagination if it encounters network error
        //   //console.log(err)
      }
    }
  }

  onSearchHandler = value => {
    this.setState({ search: value });
    if (value === "") {
      this.setState({ cities: [] });
    } else {
      requester.getRegionsBySearchParameter([`query=${value}`]).then(res => {
        res.body.then(data => {
          if (this.state.search != "") {
            this.setState({ cities: data });
          }
        });
      });
    }
  };

  gotoGuests = () => {
    this.props.navigation.navigate("GuestsScreen", {
      guests: this.state.guests,
      adults: this.state.adults,
      children: this.state.children,
      infants: this.state.infants,
      updateData: this.updateData,
      childrenBool: this.state.childrenBool
    });
  };

  gotoSearch = () => {
    this.setState(
      { isFilterResult: false, displayMode: DISPLAY_MODE_SEARCHING },
      () => {
        this.saveState();
        this.getStaticHotelsData();
      }
    );
  };

  gotoCancel = () => {
    this.setState(
      // TODO: Previous State was cached separately
      //       this was done in a non-react way, saving previousState
      //       as a static object. If needed - do it again instead of using prevState
      //       as below it is supposed to use in react-ways.
      // See: https://reactjs.org/docs/react-component.html#setstate
      // change state function
      function(prevState, updatedProps) {
        let baseInfo = {};
        baseInfo["adults"] = prevState.adults;
        baseInfo["children"] = [];
        for (let i = 0; i < prevState.children.children; i++) {
          baseInfo["children"].push({ age: 0 });
        }
        let roomsData = [baseInfo];
        let roomsDummyData = encodeURI(JSON.stringify(roomsData));

        return {
          search: prevState.search,
          regionId: prevState.regionId,

          checkInDate: prevState.checkInDate,
          checkInDateFormated: prevState.checkInDateFormated,
          checkOutDate: prevState.checkOutDate,
          checkOutDateFormated: prevState.checkOutDateFormated,
          daysDifference: prevState.daysDifference,

          adults: prevState.adults,
          children: prevState.children,
          infants: prevState.infants,
          guests: prevState.guests,
          childrenBool: prevState.childrenBool,
          roomsDummyData: roomsDummyData,

          isNewSearch: false
        };
      }
    );
  };

  handleAutocompleteSelect = (id, name) => {
    // TODO: Previous State was cached separately
    //       this was done in a non-react way, saving previousState
    //       as a static object. If needed - do it again instead of using prevState
    //       as below it is supposed to use in react-ways.
    // See: https://reactjs.org/docs/react-component.html#setstate
    this.setState(
      // change state function
      function(prevState, updatedProps) {
        let stateUpdate = {
          cities: [],
          search: name,
          regionId: id
        };

        if (prevState.regionId == id) {
          stateUpdate.isNewSearch = true;
        }
      }
    );
  };

  onDatesSelect = ({ startDate, endDate, startMoment, endMoment }) => {
    const start = moment(startDate, "ddd, DD MMM");
    const end = moment(endDate, "ddd, DD MMM");
    this.setState({
      daysDifference: moment.duration(end.diff(start)).asDays(),
      checkInDate: startDate,
      checkOutDate: endDate,
      checkInDateFormated: startMoment.format("DD/MM/YYYY"),
      checkOutDateFormated: endMoment.format("DD/MM/YYYY"),
      isNewSearch: true
    });
  };

  updateData = data => {
    if (
      this.state.adults === data.adults &&
      this.state.children === data.children &&
      this.state.infants === data.infants &&
      this.state.childrenBool === data.childrenBool
    ) {
      return;
    }

    let baseInfo = {};
    baseInfo["adults"] = data.adults;
    baseInfo["children"] = [];
    for (let i = 0; i < data.children; i++) {
      baseInfo["children"].push({ age: 0 });
    }
    let roomsData = [baseInfo];
    let roomsDummyData = encodeURI(JSON.stringify(roomsData));

    this.setState({
      adults: data.adults,
      children: data.children,
      infants: data.infants,
      guests: data.adults + data.children + data.infants,
      childrenBool: data.childrenBool,
      roomsDummyData: roomsDummyData,
      isNewSearch: true
    });
  };

  saveState() {
    //console.log('#hotel-search# 5/6 HotelSearchScreen saveState END');

    this.setState(function(prevState, propsUpdated) {
      // TODO: Previous State was cached separately
      //       this was done in a non-react way, saving previousState
      //       as a static object. If needed - include it
      // See: https://reactjs.org/docs/react-component.html#setstate
      /*                
                prevState.search = this.state.search;
                prevState.regionId = this.state.regionId;

                prevState.checkInDate = this.state.checkInDate;
                prevState.checkInDateFormated = this.state.checkInDateFormated;
                prevState.checkOutDate = this.state.checkOutDate;
                prevState.checkOutDateFormated = this.state.checkOutDateFormated;
                prevState.daysDifference = this.state.daysDifference;

                prevState.adults = this.state.adults;
                prevState.children = this.state.children;
                prevState.infants = this.state.infants;
                prevState.guests = this.state.guests;
                prevState.childrenBool = this.state.childrenBool;
 */

      return {
        //filters
        showUnAvailable: false,
        nameFilter: "",
        selectedRating: [false, false, false, false, false],
        orderBy: "rank,desc",
        priceRange: [1, 5000],
        isNewSearch: false
      };
    });

    if (this.state.isHotel) {
      this.searchString = generateSearchString(this.state, this.props);
    }
  }

  gotoSettings = () => {
    if (this.state.allElements) {
      if (this.state.isHotel) {
        this.props.navigation.navigate("HotelFilterScreen", {
          isHotelSelected: true,
          updateFilter: this.updateFilter,
          selectedRating: this.state.selectedRating,
          showUnAvailable: this.state.showUnAvailable,
          hotelName: this.state.nameFilter,
          priceRange: [this.socketPriceMin, this.socketPriceMax]
        });
      }
    }
  };

  updateFilter = data => {
    console.log("[HotelsSearchScreen] updateFilter", { data });

    // TODO: Fix this direct method call
    // if (this.listViewRef != undefined && this.listViewRef != null) {
    // this.listViewRef.initListView();
    // }

    // TODO: Fix this direct method call
    // if (this.mapView != undefined && this.mapView != null) {
    // this.mapView.initMapView();
    // }

    // set isLoading in Redux
    this.props.setIsApplyingFilter(true);

    this.priceMin = data.sliderValue[0];
    this.priceMax = data.sliderValue[1];

    this.setState(
      // change state (object in this case)
      {
        isFilterResult: true,
        showUnAvailable: data.showUnAvailable,
        nameFilter: data.hotelName,
        selectedRating: data.selectedRating,
        orderBy: data.priceSort,
        priceRange: data.sliderValue,
        // hotelsInfo: [],
        // hotelsInfoForMap: [],
      },
      // callback (after change state above)
      function() {
        // this.applyFilters();
        const search = generateSearchString(this.state, this.props);
        const filters = generateHotelFilterString(0, this.state);
        ////console.log("search --- filters", search, filters);
        this.fetchFilteredResults(search, filters);
      }
    );
  };

  fetchFilteredResults = (strSearch, strFilters) => {
    // get all results instead of only first page
    
    // requester methods:
    
    // (1) getLastSearchHotelResultsByFilter(strSearch, strFilters)
    //    - this one returns a filtered last search page only
    // Example:
    //    requester
    //      .getLastSearchHotelResultsByFilter(strSearch, strFilters)
    //      .then(this.onFilteredData);

    // (2) getMapInfo(strSearch+strFilters)
    //    - this one returns all search results filtered
    // Example:
    //    requester
    //      .getMapInfo( strSearch + strFilters )
    //      .then(this.onFilteredData);


    requester
      // .getLastSearchHotelResultsByFilter(strSearch, strFilters)
      .getMapInfo( strSearch + strFilters )
      .then(this.onFilteredData);
  };

  renderBackButtonAndSearchField() {
    return (
      <View style={styles.searchAndPickerwarp}>
        <View style={styles.searchAreaView}>
          <SearchBar
            autoCorrect={false}
            value={this.state.search}
            onChangeText={this.onSearchHandler}
            placeholder="Discover your next experience"
            placeholderTextColor="#bdbdbd"
            leftIcon="arrow-back"
            onLeftPress={this.onBackButtonPress}
            editable={this.state.editable}
          />
        </View>
      </View>
    );
  }

  renderCalendarAndFilters() {
    return (
      <View
        style={[
          this.state.isNewSearch
            ? { height: 190, width: "100%" }
            : { height: 70, width: "100%" },
          { borderBottomWidth: 1 }
        ]}
      >
        <DateAndGuestPicker
          checkInDate={this.state.checkInDate}
          checkOutDate={this.state.checkOutDate}
          checkInDateFormated={this.state.checkInDateFormated}
          checkOutDateFormated={this.state.checkOutDateFormated}
          adults={this.state.adults}
          children={this.state.children}
          infants={this.state.infants}
          guests={this.state.guests}
          gotoGuests={this.gotoGuests}
          gotoSearch={this.gotoSearch}
          gotoCancel={this.gotoCancel}
          onDatesSelect={this.onDatesSelect}
          gotoSettings={this.gotoSettings}
          disabled={!this.state.editable}
          showSearchButton={this.state.isNewSearch}
          showCancelButton={this.state.isNewSearch}
          isFilterable={true}
        />
      </View>
    );
  }

  renderPaginationFetchingView = () => (
    <View
      style={{
        width,
        height: height - 160,
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <LTLoader />
    </View>
  );

  renderPaginationWaitingView = () => {
    return (
      <View
        style={{
          flex: 0,
          width,
          height: 55,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <DotIndicator
          color="#d97b61"
          count={3}
          size={9}
          animationDuration={777}
        />
      </View>
    );
  };

  renderPaginationAllLoadedView = () => {
    return null;
    // @@debug
    // return this.renderContentMessage('All Loaded View');
  };

  renderFooter = () => {
    // options to set
    const isShowAllSockets = true;
    const isFilterStatusEnabled = false;
    const isFiltered = (this.state.isFilterResult && isFilterStatusEnabled);

    const { commonText } = require("../../../../common.styles");

    // format prices information
    const allSocketPrices = (
      isShowAllSockets
        ? `${this.state.pricesFromSocketValid}/${this.state.pricesFromSocket}`
        : this.state.pricesFromSocketValid
    )
    const socketPricesCount = (this.state.pricesFromSocket > 0 ? allSocketPrices : `${this.state.pricesFromSocketValid}`);
    const isSocketRedColor = (this.state.isSocketTimeout && !isFiltered);

    // format hotels count information
    const hotelsLoadedCount = `${this.state.hotelsLoadedInList}/${this.state.totalHotels}`

    // create visual text components
    const leftText = (
      <Text
        style={{
          ...commonText,
          fontSize: 12,
          fontWeight: "normal",
          textAlign: (isFiltered  ? "center" : "left"),
          color: isSocketRedColor ? "red" : "black",
          paddingLeft: 5,
          width: (isFiltered ? "100%" : "50%"),
          // backgroundColor: '#0F02'
        }}
      >
        {
          isFiltered
            ?
              this.props.isApplyingFilter
                ? lang.TEXT.SEARCH_HOTEL_RESULTS_FILTER_IN_PROGRESS
                : lang.TEXT.SEARCH_HOTEL_RESULTS_FILTERED.replace("%1",this.state.totalHotels)
            :
              this.state.pricesFromSocketValid > 0
                ? // show prices loaded
                  lang.TEXT.SEARCH_HOTEL_RESULTS_PRICES.replace("$$1",socketPricesCount)
                : // loading or timeout message
                this.state.isSocketTimeout
                  ? lang.TEXT.SEARCH_HOTEL_RESULTS_PRICES_TIMEOUT
                  : lang.TEXT.SEARCH_HOTEL_RESULTS_PRICES_LOADING}
      </Text>
    );
    const rightText = (
      <Text
        style={{
          ...commonText,
          fontSize: 12,
          fontWeight: "normal",
          textAlign: "right",
          width: isFiltered ? 0 : "50%",
          color: this.state.isStaticTimeout ? "red" : "black",
          paddingRight: 5
        }}
      >
        {
          isFiltered
            ? ''
            :
              this.state.totalHotels > 0 || this.state.isFilterResult
                ? // show loaded hotels
                  this.state.isStaticTimeout
                    ? lang.TEXT.SEARCH_HOTEL_RESULTS_HOTELS_TIMEOUT
                    : lang.TEXT.SEARCH_HOTEL_RESULTS_FOUND.replace("$$1",hotelsLoadedCount)
                : // loading or timeout message
                  this.state.isStaticTimeout
                    ? lang.TEXT.SEARCH_HOTEL_RESULTS_HOTELS_TIMEOUT
                    : lang.TEXT.SEARCH_HOTEL_RESULTS_HOTELS_LOADING}
      </Text>
    );

    return (
      <View
        style={{
          width: "100%",
          height: 30,
          flexDirection: "row",
          justifyContent: "space-evenly",
          alignItems: "flex-end",
          borderTopWidth: 1,
          borderColor: "#000",
          paddingBottom: 5
        }}
      >
        {leftText}
        {rightText}
      </View>
    );
  };

  renderListItem = (item, index) => {
    this.renderItemTimes++;
    // console.log(`    #hotel-search# [HotelsSearchScreen] renderListItem id: ${item.id}, index: ${index}, renderItemTimes: ${this.renderItemTimes}`)

    return (
      <HotelItemView
        item={item}
        gotoHotelDetailsPage={this.gotoHotelDetailsPageByList}
        daysDifference={this.state.daysDifference}
        isDoneSocket={this.state.isDoneSocket}
        parent={this}
      />
    );
  };

  renderResultsAsList() {
    // console.log(`### [HotelsSearchScreen] renderResultsAsList len:${this.state.hotelsInfo.length}`)
    const scale = (
      this.state.displayMode == DISPLAY_MODE_RESULTS_AS_LIST
        ? 1.0
        : 0.0
    )
    const transform = [{scaleX: scale},{scaleY: scale}]
    console.log(`#@# [HotelsSearchScreen] renderResultsAsList, display: ${this.state.displayMode}, ListScale: ${scale}, data: ${this.state.hotelsInfo}`)

    return (
      <UltimateListView
        ref={ref => (this.listViewRef = ref)}
        key={"hotelsList"} // this is important to distinguish different FlatList, default is numColumns
        onFetch={this.onFetchNewListViewData}
        keyExtractor={(item, index) => {
          // //console.log(`### [HotelsSearchScreen] item:${item}: index:${index}`)
          return `${index} - ${item}`;
        }} // this is required when you are using FlatList
        refreshableMode={"basic"}
        data={[]}
        numColumns={1} // to use grid layout, simply set gridColumn > 1
        item={this.renderListItem} // this takes three params (item, index, separator)
        paginationFetchingView={this.renderPaginationFetchingView}
        paginationWaitingView={this.renderPaginationWaitingView}
        paginationAllLoadedView={this.renderPaginationAllLoadedView}
        style={{ transform }}
      />
    );
  }

  renderResultsAsMap() {
    // console.log(`Render map with ${this.state.hotelsInfo.length} hotels`);
    const height = (this.state.displayMode == DISPLAY_MODE_RESULTS_AS_MAP
      ? "100%"
      : "0%"
    );
    let result = null;

    //@@@debug
    // console.log(`[HotelsSearchScreen] Map hotels ${this.state.hotelsInfoForMap.length}/${this.state.hotelsInfo.length}`);
    this.state.hotelsInfoForMap.map((item, index) => {
      // if (item.lon)
      // console.log(`    Hotel ${index} lat:${item.lat} lon:${item.lon}`);

      return item
    })

    if (hasValidCoordinatesForMap(this.state, true)) {
      result = (
        <MapModeHotelsSearch
          ref={ref => {
            if (!!ref) {
              this.mapView = ref.getWrappedInstance();
            }
          }}
          isFilterResult={this.state.isFilterResult}
          initialLat={this.state.initialLat}
          initialLon={this.state.initialLon}
          daysDifference={this.state.daysDifference}
          hotelsInfo={this.state.hotelsInfoForMap}
          gotoHotelDetailsPage={this.gotoHotelDetailsPageByMap}
          style={{ height }}
        />
      );
    }

    return result;
  }

  renderMapButton() {
    if (hasValidCoordinatesForMap(this.state, true)) {
      // if (this.state.allElements) {
      const isMap = this.state.displayMode == DISPLAY_MODE_RESULTS_AS_MAP;
      const isList = this.state.displayMode == DISPLAY_MODE_RESULTS_AS_LIST;
      const isShowingResults = isMap || isList;
      const hasValidCoordinates = hasValidCoordinatesForMap(this.state, true);

      // console.log(`---- coordinates: ${hasValidCoordinates}, ${this.state.initialLat}/${this.state.initialLon}`);

      return (
        (isShowingResults || hasValidCoordinates) && (
          <TouchableOpacity
            onPress={this.onToggleMapOrListResultsView}
            style={styles.switchButton}
          >
            <FontAwesome style={styles.icon}>
              {isMap && !isList ? Icons.listUl : Icons.mapMarker}
            </FontAwesome>
          </TouchableOpacity>
        )
      );
    }
  }

  renderContentMessage(text) {
    return (
      <View
        style={{
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <Text
          style={{
            ...require("../../../../common.styles").commonText,
            textAlign: "center",
            fontSize: 20
          }}
        >
          {text}
        </Text>
      </View>
    );
  }

  onWebViewLoadStart() {
    console.log("[HotelsSearchScreen] Webview load started");
  }

  onWebViewLoadEnd() {
    console.log("[HotelsSearchScreen] Webview loaded");
    this.setState({ isLoading: false });
  }

  onWebViewNavigationState(navState) {
    console.log("[HotelsSearchScreen] Webview nav state");
  }

  renderHotelDetailsAsWebview() {
    let result = false;

    if (this.state.isLoading) {
      // result = this.renderContentMessage(`Loading ${this.state.webViewUrl}`);
      result = <LTLoader />;
    } else {
      result = (
        <WebView
          ref={ref => {
            this.webViewRef = ref;
          }}
          onWebviewNavigationStateChange={navState =>
            this.onWebViewNavigationState(navState)
          }
          onLoadStart={() => this.onWebViewLoadStart}
          onLoadEnd={() => this.onWebViewLoadEnd()}
          source={{ uri: this.state.webViewUrl }}
        />
      );
    }

    return result;
  }

  renderContent() {
    let result = null;

    switch (this.state.displayMode) {
      case DISPLAY_MODE_NONE:
      case DISPLAY_MODE_RESULTS_AS_LIST:
      case DISPLAY_MODE_RESULTS_AS_MAP:
      case DISPLAY_MODE_SEARCHING:
        // see render() method
        break;

      case DISPLAY_MODE_HOTEL_DETAILS:
        if (!isNative.hotelItem) {
          result = this.renderHotelDetailsAsWebview();
        } else {
          // TODO: Render native item inside here
          this.renderContentMessage("TODO: Native hotel details");
        }
        break;

      default:
        result = this.renderContentMessage(`N/A (${this.state.displayMode})`);
        break;
    }

    return result;
  }

  render() {
    // TODO: @@debug - remove this
    // this.renderTimes++;
    //if (this.renderTimes <= 20)
    // console.log(`#hotel-search# 6/6 HotelSearchScreen render #${this.renderTimes}`);

    // console.log(`### [HotelsSearchScreen] {all:this.state.allElements});

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {this.renderBackButtonAndSearchField()}
          {this.renderCalendarAndFilters()}

          <View style={styles.containerHotels}>
            {this.renderResultsAsMap()}
            {this.renderResultsAsList()}
            {this.renderContent()}

            {this.renderMapButton()}
          </View>

          {this.renderFooter()}
        </View>

        {/* <ProgressDialog
                      visible={this.state.isLoading}
                      title="Please Wait"
                      message="Loading..."
                      animationType="slide"
                      activityIndicatorSize="large"
                      activityIndicatorColor="black"/> */}
        <LTLoader isLoading={this.state.isApplyingFilter || this.state.isLoading} />
      </SafeAreaView>
    );
  }
}

const mapStateToProps = state => {
  return {
    currency: state.currency.currency,
    isApplyingFilter: state.userInterface.isApplyingFilter
  };
};
const mapDispatchToProps = dispatch => ({
  setIsApplyingFilter: bindActionCreators(setIsApplyingFilter, dispatch),
})


export default connect(mapStateToProps, mapDispatchToProps)(HotelsSearchScreen);
