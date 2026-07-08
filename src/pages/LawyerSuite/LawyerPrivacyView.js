import React from 'react';

const LawyerPrivacyView = () => {
  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-surface-container-lowest">
      <div className="mb-8 animate-fadeIn">
        <h2 className="font-serif text-[32px] font-bold text-[#041635] mb-2">Privacy & Security</h2>
        <p className="text-gray-600 text-[15px] max-w-xl">
          Manage your account security, two-factor authentication, and data sharing preferences.
        </p>
      </div>

      <div className="bg-white p-8 rounded-lg border border-[#D0D7E3] shadow-sm animate-fadeIn max-w-2xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h4 className="font-bold text-gray-800">Two-Factor Authentication</h4>
              <p className="text-sm text-gray-500">Add an extra layer of security to your account.</p>
            </div>
            <button className="px-4 py-2 border border-primary text-primary rounded-lg text-sm font-bold hover:bg-primary hover:text-white transition-colors">
              Enable 2FA
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h4 className="font-bold text-gray-800">Profile Visibility</h4>
              <p className="text-sm text-gray-500">Allow your profile to be discovered by clients.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h4 className="font-bold text-gray-800">Change Password</h4>
              <p className="text-sm text-gray-500">Update your password to keep your account secure.</p>
            </div>
            <button className="text-primary font-bold text-sm hover:underline">
              Update
            </button>
          </div>
          
          <div className="pt-2">
            <button className="text-red-600 font-bold text-sm hover:underline">
              Request Account Deletion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LawyerPrivacyView;
