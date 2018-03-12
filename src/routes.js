import { StackNavigator } from 'react-navigation';

import Welcome from './components/login/Welcome';
import Login from './components/login/Login';
import CreateAccount from './components/login/CreateAccount';

// export const RootNavigator = StackNavigator(
//   {
//     Home: { screen: HomeScreen }
//   },
//   {
//     headerMode: 'none'
//   }
// );

export const LoginNavigator = StackNavigator(
  {
    Welcome: { screen: Welcome },
    Login: { screen: Login },
    CreateAccount: { screen: CreateAccount }
  },
  {
    initialRouteName: 'CreateAccount',
    headerMode: 'none',
  }
);
