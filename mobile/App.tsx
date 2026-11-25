import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import type { RootStackParamList } from './src/navigation';
import HomeScreen from './src/screens/HomeScreen';
import ProductScreen from './src/screens/ProductScreen';
import OrderStatusScreen from './src/screens/OrderStatusScreen';
import SellerDashboardScreen from './src/screens/SellerDashboardScreen';
import SellerNewProductScreen from './src/screens/SellerNewProductScreen';
import SellerApplyScreen from './src/screens/SellerApplyScreen';
import SignInScreen from './src/screens/SignInScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="SellerApply" component={SellerApplyScreen} />
        <Stack.Screen name="Product" component={ProductScreen} />
        <Stack.Screen name="OrderStatus" component={OrderStatusScreen} />
        <Stack.Screen name="SellerDashboard" component={SellerDashboardScreen} />
        <Stack.Screen name="SellerNewProduct" component={SellerNewProductScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
