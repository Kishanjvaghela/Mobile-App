echo; echo "Enabling Android support for Reactotron"
adb reverse tcp:9090 tcp:9090
adb reverse --list
echo