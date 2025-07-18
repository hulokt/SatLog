import React, { useState } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Clock, Send, CheckCircle } from 'lucide-react';

const ContactPage = ({ onBack }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate form submission
    setIsSubmitted(true);
    setTimeout(() => setIsSubmitted(false), 3000);
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  const contactInfo = [
    {
      icon: Mail,
      title: "Email",
      value: "support@thinklytics.com",
      description: "We typically respond within 24 hours"
    },
    {
      icon: Phone,
      title: "Phone",
      value: "+1 (555) 123-4567",
      description: "Monday-Friday, 9AM-6PM EST"
    },
    {
      icon: MapPin,
      title: "Office",
      value: "Tampa, Florida",
      description: "Visit us by appointment"
    }
  ];

  const faqs = [
    {
      question: "How do I get started with Thinklytics?",
      answer: "Simply sign up for a free account and start logging your SAT questions. Our platform will help you track your progress and identify areas for improvement."
    },
    {
      question: "Is my data secure?",
      answer: "Yes, we use enterprise-grade security measures to protect your personal information and study data. Your privacy is our top priority."
    },
    {
      question: "Do you offer refunds?",
      answer: "We offer a 30-day money-back guarantee for all paid plans. If you're not satisfied, we'll refund your purchase."
    },
    {
      question: "Can I use Thinklytics on mobile?",
      answer: "Yes, our platform is fully responsive and works great on all devices including smartphones and tablets."
    }
  ];

  return (
    <div className="min-h-screen homepage-bg transition-colors duration-300">
      {/* Header */}
      <div className="homepage-card shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg homepage-card hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 homepage-text-primary" />
            </button>
            <h1 className="text-3xl font-bold homepage-text-primary">Contact Us</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold homepage-text-primary mb-6">
            Get in
            <span className="homepage-gradient-text"> Touch</span>
          </h2>
          <p className="text-xl homepage-text-secondary max-w-3xl mx-auto leading-relaxed">
            Have questions about Thinklytics? Need help with your SAT preparation? 
            We're here to help you succeed. Reach out to us anytime.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="homepage-card rounded-2xl shadow-xl p-8 homepage-hover-glow">
            <h3 className="text-2xl font-bold homepage-text-primary mb-6">Send us a Message</h3>
            
            {isSubmitted ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h4 className="text-xl font-semibold homepage-text-primary mb-2">Message Sent!</h4>
                <p className="homepage-text-secondary">
                  Thank you for reaching out. We'll get back to you within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium homepage-text-secondary mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 homepage-card homepage-text-primary focus:ring-2 focus:ring-[var(--brand-60)] focus:border-transparent"
                    placeholder="Your full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium homepage-text-secondary mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 homepage-card homepage-text-primary focus:ring-2 focus:ring-[var(--brand-60)] focus:border-transparent"
                    placeholder="your.email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium homepage-text-secondary mb-2">
                    Subject
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => handleInputChange('subject', e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 homepage-card homepage-text-primary focus:ring-2 focus:ring-[var(--brand-60)] focus:border-transparent"
                  >
                    <option value="">Select a subject</option>
                    <option value="general">General Inquiry</option>
                    <option value="support">Technical Support</option>
                    <option value="billing">Billing Question</option>
                    <option value="feature">Feature Request</option>
                    <option value="partnership">Partnership</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium homepage-text-secondary mb-2">
                    Message
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => handleInputChange('message', e.target.value)}
                    required
                    rows={6}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 homepage-card homepage-text-primary focus:ring-2 focus:ring-[var(--brand-60)] focus:border-transparent resize-none"
                    placeholder="Tell us how we can help you..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full homepage-cta-primary text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 hover:shadow-xl"
                >
                  <Send className="w-5 h-5" />
                  <span>Send Message</span>
                </button>
              </form>
            )}
          </div>

          {/* Contact Information */}
          <div className="space-y-8">
            {/* Contact Details */}
            <div className="homepage-card rounded-2xl shadow-xl p-8 homepage-hover-glow">
              <h3 className="text-2xl font-bold homepage-text-primary mb-6">Contact Information</h3>
              <div className="space-y-6">
                {contactInfo.map((info, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg homepage-feature-icon flex items-center justify-center">
                        <info.icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold homepage-text-primary mb-1">{info.title}</h4>
                      <p className="blue-gradient-text font-medium mb-1">{info.value}</p>
                      <p className="text-sm homepage-text-secondary">{info.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Business Hours */}
            <div className="homepage-card rounded-2xl shadow-xl p-8 homepage-hover-glow">
              <h3 className="text-2xl font-bold homepage-text-primary mb-6">Business Hours</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Clock className="w-6 h-6 text-[var(--brand-60)]" />
                  <div>
                    <p className="font-medium homepage-text-primary">Monday - Friday</p>
                    <p className="homepage-text-secondary">9:00 AM - 6:00 PM EST</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Clock className="w-6 h-6 text-gray-400" />
                  <div>
                    <p className="font-medium homepage-text-primary">Saturday</p>
                    <p className="homepage-text-secondary">10:00 AM - 4:00 PM EST</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Clock className="w-6 h-6 text-gray-400" />
                  <div>
                    <p className="font-medium homepage-text-primary">Sunday</p>
                    <p className="homepage-text-secondary">Closed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold homepage-text-primary mb-8 text-center">Frequently Asked Questions</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {faqs.map((faq, index) => (
              <div key={index} className="homepage-card rounded-xl p-6 shadow-lg homepage-hover-glow">
                <h4 className="text-lg font-semibold homepage-text-primary mb-3">{faq.question}</h4>
                <p className="homepage-text-secondary">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 blue-gradient-bg rounded-2xl p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-4">Ready to Get Started?</h3>
          <p className="text-lg mb-6 opacity-90">
            Join thousands of students who are already improving their SAT scores with Thinklytics.
          </p>
          <button className="bg-white text-[var(--brand-60)] hover:bg-gray-100 px-8 py-3 rounded-lg font-medium transition-colors">
            Start Free Trial
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactPage; 