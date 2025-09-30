import { type NextPage } from "next";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Image from "next/image";

const SignIn: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const session = await getSession();
      if (session) {
        void router.push("/");
      }
    };
    void checkSession();
  }, [router]);

  const handleGoogleSignIn = () => {
    void signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex w-full max-w-7xl">
        {/* Left Section - Sign In Form */}
        <div className="flex w-2/3 flex-col justify-center bg-white px-16">
          <div className="max-w-lg">
            {/* Airtable Logo */}
            <div className="mb-8">
              <Image
                src="/icons/airtable-logo.png"
                alt="Airtable"
                width={120}
                height={40}
                className="h-15 w-auto"
              />
            </div>

            {/* Main Title */}
            <h1 className="mb-8 pt-5 text-3xl text-black">
              Sign in to Airtable
            </h1>

            {/* Email Field */}
            <div className="mb-6">
              <label
                htmlFor="email"
                className="mb-2 block text-sm text-gray-700"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder="Email address  "
              />
            </div>

            {/* Continue Button */}
            <button className="font-small mb-6 w-full rounded-lg bg-[#93b0e4] px-4 py-3 text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none">
              Continue
            </button>

            {/* Divider */}
            <div className="mb-6 flex items-center">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="px-4 text-sm text-gray-500">or</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>

            {/* Alternative Sign In Options */}
            <div className="space-y-3">
              <button className="font-small w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none">
                Sign in with Single Sign On
              </button>

              <button
                onClick={handleGoogleSignIn}
                className="font-small flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
              >
                <svg
                  className="mr-3 h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </button>

              <button className="font-small flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none">
                <svg
                  className="mr-3 h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                </svg>
                Continue with Apple ID
              </button>
            </div>

            {/* Create Account Link */}
            <div className="font-small mt-8 pt-10 text-left">
              <p className="text-sm text-gray-600">
                New to Airtable?{" "}
                <a
                  href="#"
                  className="border-b border-blue-600 text-blue-600 hover:text-blue-700"
                >
                  Create an account
                </a>{" "}
                instead
              </p>
            </div>
          </div>
        </div>

        {/* Right Section - Cover Image */}
        <div className="mt-10">
          <Image
            src="/icons/login-cover.png"
            alt="Login Cover"
            width={600}
            height={600}
            className="h-full w-full rounded-3xl object-cover"
          />
        </div>
      </div>
    </div>
  );
};

export default SignIn;
