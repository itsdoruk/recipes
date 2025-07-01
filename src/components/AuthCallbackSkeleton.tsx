import Skeleton from './Skeleton';

export default function AuthCallbackSkeleton() {
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="text-center space-y-4">
        <Skeleton width={200} height={24} />
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
        </div>
      </div>
    </div>
  );
} 