import { throttle, debounce } from '@/lib/throttle';

describe('throttle', () => {
  jest.useFakeTimers();

  it('should execute immediately on first call', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 100);

    throttled('test');
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should throttle subsequent calls within delay period', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 100);

    throttled('call1');
    throttled('call2');
    throttled('call3');

    expect(mockFn).toHaveBeenCalledTimes(1);
    
    jest.advanceTimersByTime(100);
    
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('call3');
  });

  it('should allow execution after delay has passed', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 100);

    throttled('call1');
    expect(mockFn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(101);
    
    throttled('call2');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should handle rapid calls correctly (non-negative delay)', () => {
    const mockFn = jest.fn();
    const throttled = throttle(mockFn, 100);

    // Rapid calls
    for (let i = 0; i < 10; i++) {
      throttled(`call${i}`);
    }

    expect(mockFn).toHaveBeenCalledTimes(1);
    
    jest.advanceTimersByTime(100);
    
    // Should have executed the last call
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('call9');
  });
});

describe('debounce', () => {
  jest.useFakeTimers();

  it('should delay execution until after delay has passed', () => {
    const mockFn = jest.fn();
    const debounced = debounce(mockFn, 100);

    debounced('test');
    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should reset delay on subsequent calls', () => {
    const mockFn = jest.fn();
    const debounced = debounce(mockFn, 100);

    debounced('call1');
    jest.advanceTimersByTime(50);
    
    debounced('call2');
    jest.advanceTimersByTime(50);
    
    debounced('call3');
    
    expect(mockFn).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(100);
    
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('call3');
  });

  it('should only execute the last call after delay', () => {
    const mockFn = jest.fn();
    const debounced = debounce(mockFn, 100);

    for (let i = 0; i < 5; i++) {
      debounced(`call${i}`);
    }

    jest.advanceTimersByTime(100);

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('call4');
  });
});
