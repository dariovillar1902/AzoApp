import { Platform } from 'react-native';

export const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5075' : 'http://localhost:5075';
