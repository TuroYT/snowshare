import path from 'path';

export const getUploadsDir = () => {
  return process.env.NODE_ENV === 'production' 
    ? path.join(process.cwd(), 'uploads')
    : path.join(process.cwd(), 'uploads');
};

export const getDataDir = () => {
  return process.env.NODE_ENV === 'production' 
    ? path.join(process.cwd(), 'data')
    : path.join(process.cwd(), 'prisma');
};