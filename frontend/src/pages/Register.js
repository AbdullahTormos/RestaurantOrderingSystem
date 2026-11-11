import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submitting registration:', formData);
    
    // Clear previous errors
    setError('');
    setLoading(true);
    
    // Basic validation
    if (!formData.name || !formData.email || !formData.password) {
      setError('Name, email, and password are required');
      setLoading(false);
      return;
    }
    
    try {
      const response = await axios.post(
        'http://localhost:5000/api/auth/register',
        formData
      );
      
      console.log('Registration successful:', response.data);
      
      // Show success message
      alert('Registration successful! Please login with your credentials.');
      
      // Clear form
      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        address: ''
      });
      
      // Redirect to login page
      navigate('/login');
      
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle different types of errors
      if (error.response) {
        // Server responded with an error
        setError(error.response.data.error || 'Registration failed');
      } else if (error.request) {
        // Request was made but no response
        setError('No response from server. Please try again.');
      } else {
        // Something else happened
        setError(error.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="register-form">
        <h2>Create Account</h2>
        
        {error && (
          <div className="error-message" style={{
            background: '#ffebee',
            color: '#c62828',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '15px'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <input
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
            disabled={loading}
            style={{ marginBottom: '10px', width: '100%', padding: '10px' }}
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            disabled={loading}
            style={{ marginBottom: '10px', width: '100%', padding: '10px' }}
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            disabled={loading}
            style={{ marginBottom: '10px', width: '100%', padding: '10px' }}
          />
          <input
            name="phone"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
            required
            disabled={loading}
            style={{ marginBottom: '10px', width: '100%', padding: '10px' }}
          />
          <textarea
            name="address"
            placeholder="Delivery Address"
            value={formData.address}
            onChange={handleChange}
            required
            disabled={loading}
            style={{ marginBottom: '20px', width: '100%', padding: '10px', minHeight: '80px' }}
          />
          
          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#ccc' : '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        
        <p style={{ marginTop: '20px', textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ color: '#1976d2' }}>Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;