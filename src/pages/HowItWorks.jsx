import { Link } from 'react-router-dom'

export default function HowItWorks() {
  const steps = [
    {
      step: 1,
      title: 'Create Your Account',
      description: 'Sign up as a client or contractor. Tell us about your skills, experience, and what you\'re looking for.',
      icon: '📝'
    },
    {
      step: 2,
      title: 'Post or Find Projects',
      description: 'Clients can post detailed project requirements. Contractors can browse and apply to relevant opportunities.',
      icon: '🔍'
    },
    {
      step: 3,
      title: 'Connect & Collaborate',
      description: 'Review applications, communicate with potential partners, and find the perfect match for your project.',
      icon: '🤝'
    },
    {
      step: 4,
      title: 'Complete Projects',
      description: 'Work together efficiently with built-in project management tools and milestone tracking.',
      icon: '✅'
    }
  ]

  return (
    <div className="bg-white">
        {/* Hero Section */}
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="text-center">
              <h1 className="text-4xl font-extrabold text-white sm:text-5xl md:text-6xl">
                How ProSkillset Works
              </h1>
              <p className="mt-3 max-w-md mx-auto text-base text-blue-100 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
                Connecting skilled contractors with clients who need their expertise. Simple, efficient, and professional.
              </p>
            </div>
          </div>
        </div>

        {/* Steps Section */}
        <div className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">
                Get Started in 4 Simple Steps
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Our platform makes it easy to find the right talent or the perfect project.
              </p>
            </div>

            <div className="mt-16">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
                {steps.map((step) => (
                  <div key={step.step} className="text-center">
                    <div className="flex items-center justify-center w-16 h-16 mx-auto bg-blue-600 rounded-full mb-4">
                      <span className="text-2xl">{step.icon}</span>
                    </div>
                    <div className="text-sm font-semibold text-blue-600 mb-2">
                      Step {step.step}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-gray-600">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">
                Why Choose ProSkillset?
              </h2>
            </div>

            <div className="mt-16">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-500 rounded-lg mb-4">
                    <span className="text-white text-xl">✓</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Verified Professionals
                  </h3>
                  <p className="text-gray-600">
                    All contractors are vetted and their skills are verified through our platform.
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 mx-auto bg-blue-500 rounded-lg mb-4">
                    <span className="text-white text-xl">💬</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Direct Communication
                  </h3>
                  <p className="text-gray-600">
                    Connect directly with clients and contractors through our secure messaging system.
                  </p>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center w-12 h-12 mx-auto bg-purple-500 rounded-lg mb-4">
                    <span className="text-white text-xl">🛡️</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Secure Payments
                  </h3>
                  <p className="text-gray-600">
                    Milestone-based payments ensure both parties are protected throughout the project.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-blue-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-white">
                Ready to Get Started?
              </h2>
              <p className="mt-4 text-xl text-blue-100">
                Join thousands of professionals already using ProSkillset.
              </p>
              <div className="mt-8 flex justify-center space-x-4">
                <Link
                  to="/signup"
                  className="bg-white text-blue-600 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Sign Up as Client
                </Link>
                <Link
                  to="/contractor-signup"
                  className="border-2 border-white text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Join as Contractor
                </Link>
              </div>
            </div>
          </div>
        </div>
    </div>
  )
}