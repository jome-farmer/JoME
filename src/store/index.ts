import {
  configureStore,
  type ThunkAction,
  type UnknownAction,
} from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { authReducer } from "./authSlice";
import { deviceReducer } from "./deviceSlice";

/** A fresh store; tests make their own. */
export const makeStore = () =>
  configureStore({ reducer: { auth: authReducer, device: deviceReducer } });

export const store = makeStore();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<R = void> = ThunkAction<
  R,
  RootState,
  unknown,
  UnknownAction
>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
