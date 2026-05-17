import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type MainTabParamList = {
  Photos: { autoStartScan?: boolean } | undefined;
  RecycleBin: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Landing: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Detail: { candidateId: string };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = {
  navigation: any;
  route: any;
};
