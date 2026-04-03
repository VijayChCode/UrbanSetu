import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from '../redux/user/userSlice';
import { persistor } from '../redux/store';
import { reconnectSocket } from '../utils/socket';
import { socket } from '../utils/socket';
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../utils/auth';
import { resetSettingsToDefaults } from '../utils/settingsSync';

export const useSignout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const signout = async (options = {}) => {
    const {
      showToast = true,
      navigateTo = "/",
      delay = 50,
      onSuccess,
      onError,
      preventEvent = false
    } = options;

    try {
      dispatch(signoutUserStart());
      const res = await authenticatedFetch(`${API_BASE_URL}/api/auth/signout`);
      const data = await res.json();

      if (data.success === false) {
        dispatch(signoutUserFailure(data.message));
        if (onError) onError(data.message);
        return;
      }

      dispatch(signoutUserSuccess(data));

      // Clear persisted state
      await persistor.purge();

      // Clear all tokens and cookies
      localStorage.removeItem('accessToken');
      localStorage.removeItem('sessionId');
      localStorage.removeItem('refreshToken');
      localStorage.setItem('logout', Date.now()); // Notify other tabs
      document.cookie = 'access_token=; Max-Age=0; path=/; SameSite=None; Secure';
      document.cookie = 'refresh_token=; Max-Age=0; path=/; SameSite=None; Secure';
      document.cookie = 'session_id=; Max-Age=0; path=/; SameSite=None; Secure';

      // Reset user settings (theme, fontSize, etc.) to defaults
      resetSettingsToDefaults();

      // Disconnect socket completely before reconnecting
      if (socket && socket.connected) {
        socket.disconnect();
      }

      // Reconnect socket with cleared auth
      reconnectSocket();

      if (showToast) {
        toast.info("You have been signed out.");
      }

      if (onSuccess) onSuccess();

      await new Promise(resolve => setTimeout(resolve, delay));
      navigate(navigateTo, { replace: true });

    } catch (error) {
      dispatch(signoutUserFailure(error.message));

      // Clear all authentication state even on error
      dispatch(signoutUserSuccess());
      await persistor.purge();

      // Clear all tokens and cookies
      localStorage.removeItem('accessToken');
      localStorage.removeItem('sessionId');
      localStorage.removeItem('refreshToken');
      document.cookie = 'access_token=; Max-Age=0; path=/; SameSite=None; Secure';
      document.cookie = 'refresh_token=; Max-Age=0; path=/; SameSite=None; Secure';
      document.cookie = 'session_id=; Max-Age=0; path=/; SameSite=None; Secure';

      // Reset user settings (theme, fontSize, etc.) to defaults
      resetSettingsToDefaults();

      // Disconnect socket completely before reconnecting
      if (socket && socket.connected) {
        socket.disconnect();
      }

      // Reconnect socket with cleared auth
      reconnectSocket();

      if (showToast) {
        toast.info("You have been signed out.");
      }

      if (onError) onError(error.message);
      navigate(navigateTo, { replace: true });
    }
  };

  return { signout };
};
