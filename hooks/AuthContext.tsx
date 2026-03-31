import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore'; // Added updateDoc
import { auth, db } from '../firebaseConfig'; // Added db import
import { registerForPushNotificationsAsync } from '../utils/notifications'; // Added push notification helper

// Define what our database profile looks like
export interface UserProfile {
  role: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  // Kept for backward compatibility with your old test accounts
  fullName?: string;
  studentId?: string;
}

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null; // Added profile state
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, isLoading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // 1. Point to the 'users' collection and search for this user's UID
          const docRef = doc(db, 'users', firebaseUser.uid);
          
          // Added a 5-second timeout to guarantee the splash screen hides even if Firestore hangs
          const docSnap = await Promise.race([
            getDoc(docRef),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Firestore timeout")), 5000))
          ]) as any;
          
          if (docSnap && docSnap.exists && docSnap.exists()) {
            // 2. If found, save it to our app's state
            setProfile(docSnap.data() as UserProfile);

            // --- NEW NOTIFICATION LOGIC ---
            // 3. Get the device push token IN THE BACKGROUND to prevent freezing the splash screen
            (async () => {
              try {
                const pushToken = await registerForPushNotificationsAsync();
                // 4. Save the token and last active timestamp to their Firebase profile
                if (pushToken) {
                  await updateDoc(docRef, {
                    pushToken: pushToken,
                    lastActive: new Date()
                  });
                }
              } catch (pushErr) {
                console.warn("Push registration failed in background:", pushErr);
              }
            })();
            // ------------------------------

          } else {
            console.warn("No Firestore profile found for this user UID.");
            // Fallback so the app doesn't crash if you forgot to make the DB entry
            const defaultName = (firebaseUser.email && firebaseUser.email.includes('@')) 
                ? firebaseUser.email.split('@')[0].charAt(0).toUpperCase() + firebaseUser.email.split('@')[0].slice(1)
                : "Babcock User";
            
            setProfile({
              firstName: defaultName,
              lastName: "Student",
              email: firebaseUser.email || "",
              role: "student"
            });
          }
        } catch (error) {
          console.error("Error fetching user profile from Firestore: ", error);
        }
      } else {
        // Clear profile if logged out
        setProfile(null);
      }
      
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};