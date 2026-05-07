import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { signoutUserStart, signoutUserSuccess, signoutUserFailure } from '../redux/user/userSlice';
import { persistor } from '../redux/store';
import { reconnectSocket } from '../utils/socket';
import { socket } from '../utils/socket';
import { toast } from 'react-toastify';
import { authenticatedFetch } from '../utils/auth';
import { resetSettingsToDefaults } from '../utils/settingsSync';
import { clearSentinelData } from '../utils/sentinelLiveEngine';

export const useSignout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { currentUser } = useSelector((state) => state.user);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const signout = async (options = {}) => {
    const {
      showToast = true,
      navigateTo = "/",
      delay = 50,
      onSuccess,
      onError,
      preventEvent = false,
      forceLocal = false
    } = options;

    if (forceLocal) {
      await clearLocalAuthState();
      dispatch(signoutUserSuccess());
      navigate(navigateTo, { replace: true });
      return;
    }

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
      await clearLocalAuthState();

      if (showToast) {
        toast.info("You have been signed out.");
      }

      if (onSuccess) onSuccess();

      await new Promise(resolve => setTimeout(resolve, delay));
      navigate(navigateTo, { replace: true });

    } catch (error) {
      dispatch(signoutUserFailure(error.message || "Network error. Please try again."));
      if (onError) onError(error.message);
    }
  };

  const clearLocalAuthState = async () => {
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

    // Clear Sentinel interaction history (Recently Viewed data)
    if (currentUser?._id) {
      clearSentinelData(currentUser._id);
    }

    // Disconnect socket completely before reconnecting
    if (socket && socket.connected) {
      socket.disconnect();
    }

    // Reconnect socket with cleared auth
    reconnectSocket();
  };

  return { signout };
};
