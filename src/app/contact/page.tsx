'use client';

import { useState } from 'react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_key: process.env.NEXT_PUBLIC_WEB3FORMS_KEY as string,
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          message: formData.message,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: '',
        });
        setIsSubmitted(true);
      } else {
        setError('Mesajınız gönderilirken bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } catch (err) {
      setError('Bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <section className="text-center animate-fade-in pt-12">
        <h1 className="text-5xl font-bold mb-6 gradient-text">İletişim</h1>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto">
          Need Money For Porsche hakkında sorularınız mı var? Size yardımcı olmaktan mutluluk duyarız.
        </p>
      </section>

      <section className="grid md:grid-cols-2 gap-12">
        <div className="p-6 ">
          <h2 className="text-3xl font-bold mb-8 gradient-text">Bize Ulaşın</h2>
          
          <div className="space-y-6">
            <div className="flex items-start blur-bg p-6 rounded-lg">
              <div className="bg-zinc-900 p-3 rounded-full mr-4">
                <svg className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zm1.5-4.87h.01M6.5 19h11a2.5 2.5 0 002.5-2.5V7.5A2.5 2.5 0 0017.5 5h-11A2.5 2.5 0 004 7.5v9A2.5 2.5 0 006.5 19z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Instagram</h3>
                <p className="text-gray-400">
                  <a href="https://www.instagram.com/needmoneyforporsche_ton/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    @needmoneyforporsche_ton
                  </a>
                </p>
              </div>
            </div>
            
            <div className="flex items-start blur-bg p-6 rounded-lg">
              <div className="bg-zinc-900 p-3 rounded-full mr-4">
                <svg className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Telegram</h3>
                <p className="text-gray-400">
                  <a href="https://t.me/needmoneyforporschewtf" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    @needmoneyforporschewtf
                  </a>
                </p>
              </div>
            </div>
            
            <div className="flex items-start blur-bg p-6 rounded-lg">
              <div className="bg-zinc-900 p-3 rounded-full mr-4">
                <svg className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Sosyal Medya</h3>
                <div className="flex space-x-4 mt-2">
                  <a href="https://x.com/NMFPorsche_Ton" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-white transition-colors">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                    </svg>
                  </a>
                  <a href="https://www.instagram.com/needmoneyforporsche_ton/" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-white transition-colors">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 bg-zinc-900 p-6 rounded-lg blur-bg">
            <h3 className="text-xl font-bold mb-3">Topluluk Desteği</h3>
            <p className="text-gray-400 mb-4">
              Sık sorulan sorulara hızlı cevaplar için aktif topluluğumuza katılın.
            </p>
            <a 
              href="https://t.me/needmoneyforporschewtf" 
              target="_blank" 
              rel="noopener noreferrer"
              className="web3-button inline-block bg-zinc-800 text-white px-6 py-3 rounded-md font-medium hover:text-white transition-colors"
            >
              Telegram Topluluğumuza Katılın
            </a>
          </div>
          
          <div className="mt-6 bg-zinc-900 p-6 rounded-lg blur-bg">
            <h3 className="text-xl font-bold mb-3">NMFP Bot</h3>
            <p className="text-gray-400 mb-4">
              NMFP Telegram oyununu oynamak için botu başlatın.
            </p>
            <a 
              href="https://t.me/NMFP_bot" 
              target="_blank" 
              rel="noopener noreferrer"
              className="web3-button inline-block bg-purple-600 text-white px-6 py-3 rounded-md font-medium hover:bg-purple-700 transition-colors"
            >
              Oyunu Başlat
            </a>
          </div>
        </div>

        <div className="blur-bg p-6 rounded-lg">
          <h2 className="text-3xl font-bold mb-8 gradient-text">Mesaj Gönder</h2>
          
          {isSubmitted ? (
            <div className="text-center py-8">
              <svg className="h-16 w-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h3 className="text-2xl font-bold mb-2">Mesajınız Gönderildi!</h3>
              <p className="text-gray-400">En kısa sürede size dönüş yapacağız.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Adınız
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="Adınız"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  E-posta
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="E-posta adresiniz"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">
                  Konu
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="Mesajınızın konusu"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
                  Mesajınız
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={4}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                  placeholder="Mesajınızı buraya yazın"
                />
              </div>

              {error && (
                <div className="text-red-500 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Gönderiliyor...' : 'Gönder'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
} 