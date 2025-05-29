import { useState, memo } from 'react';
import PropTypes from 'prop-types';
import { Heart, MessageSquare, Repeat, Zap, Activity, Timer, MapPin } from 'lucide-react';
import { getAvatarUrl } from '../utils/imageHelpers';
import { formatDistanceToNow } from '../utils/timeHelpers';

// Memoized comment component
const Comment = memo(({ comment, onReply, onZap }) => {
  const avatarUrl = getAvatarUrl(comment.author.profile?.picture, 32);
  const displayName = comment.author.profile?.name || 
                     comment.author.profile?.display_name || 
                     `${comment.author.pubkey.slice(0, 8)}...`;
  
  return (
    <div className="activity-comment">
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={displayName}
          className="comment-avatar"
          width="32"
          height="32"
        />
      )}
      <div className="comment-content">
        <div className="comment-header">
          <strong>{displayName}</strong>
          <span className="comment-time">
            {formatDistanceToNow(comment.created_at)}
          </span>
        </div>
        <p>{comment.content}</p>
        <div className="comment-actions">
          <button onClick={() => onReply(comment)}>Reply</button>
          <button onClick={() => onZap(comment)}>Zap</button>
        </div>
      </div>
    </div>
  );
});

Comment.displayName = 'Comment';

// Main activity card component
export const ActivityCard = memo(({
  activity,
  isLiked,
  isReposted,
  onLike,
  onRepost,
  onZap,
  onComment,
  wallet
}) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  
  // Author info
  const avatarUrl = getAvatarUrl(activity.author.profile?.picture, 48);
  const displayName = activity.author.profile?.name || 
                     activity.author.profile?.display_name || 
                     `${activity.author.pubkey.slice(0, 8)}...`;
  
  const handleComment = (e) => {
    e.preventDefault();
    if (commentText.trim()) {
      onComment(activity.id, commentText);
      setCommentText('');
      setReplyingTo(null);
    }
  };
  
  const handleReply = (comment) => {
    setReplyingTo(comment);
    setCommentText(`@${comment.author.profile?.name || comment.author.pubkey.slice(0, 8)} `);
  };
  
  const handleZapComment = (comment) => {
    onZap(comment.id, 21, wallet);
  };
  
  return (
    <div className="activity-card">
      {/* Header */}
      <div className="activity-header">
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt={displayName}
            className="author-avatar"
            width="48"
            height="48"
          />
        )}
        <div className="author-info">
          <h4>{displayName}</h4>
          <div className="activity-meta">
            <span>{formatDistanceToNow(activity.created_at)}</span>
            {activity.type === 'workout' && <Activity size={16} />}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="activity-content">
        {activity.type === 'workout' ? (
          <WorkoutSummary workout={activity.workout} />
        ) : (
          <>
            <p>{activity.content}</p>
            {activity.images?.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt="Activity"
                className="activity-image"
                loading="lazy"
              />
            ))}
          </>
        )}
        {activity.content && activity.type === 'workout' && (
          <p className="workout-notes">{activity.content}</p>
        )}
      </div>
      
      {/* Actions */}
      <div className="activity-actions">
        <button
          className={`action-btn ${isLiked ? 'active' : ''}`}
          onClick={() => onLike(activity.id)}
        >
          <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
          <span>{activity.reactions.likes}</span>
        </button>
        
        <button
          className={`action-btn ${isReposted ? 'active' : ''}`}
          onClick={() => onRepost(activity.id)}
        >
          <Repeat size={18} />
          <span>{activity.reactions.reposts}</span>
        </button>
        
        <button
          className="action-btn"
          onClick={() => onZap(activity.id, 21, wallet)}
        >
          <Zap size={18} />
          <span>{activity.reactions.zaps}</span>
        </button>
        
        <button
          className="action-btn"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageSquare size={18} />
          <span>{activity.reactions.comments.length}</span>
        </button>
      </div>
      
      {/* Comments Section */}
      {showComments && (
        <div className="activity-comments">
          {activity.reactions.comments.map(comment => (
            <Comment
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onZap={handleZapComment}
            />
          ))}
          
          <form onSubmit={handleComment} className="comment-form">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={replyingTo ? `Replying to ${replyingTo.author.profile?.name}...` : "Add a comment..."}
              className="comment-input"
            />
            <button type="submit" disabled={!commentText.trim()}>
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
});

// Workout summary component
const WorkoutSummary = ({ workout }) => {
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };
  
  return (
    <div className="workout-summary">
      <h3 className="workout-title">
        {workout.title || `${workout.type || 'Workout'} Session`}
      </h3>
      
      <div className="workout-stats">
        {workout.duration > 0 && (
          <div className="stat">
            <Timer size={16} />
            <span>{formatDuration(workout.duration)}</span>
          </div>
        )}
        
        {workout.distance > 0 && (
          <div className="stat">
            <MapPin size={16} />
            <span>{(workout.distance / 1000).toFixed(2)} km</span>
          </div>
        )}
      </div>
      
      {workout.exercises.length > 0 && (
        <div className="workout-exercises">
          <h4>Exercises:</h4>
          <ul>
            {workout.exercises.map((exercise, idx) => (
              <li key={idx}>
                Exercise {idx + 1}: {exercise.values.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

ActivityCard.displayName = 'ActivityCard';

ActivityCard.propTypes = {
  activity: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['workout', 'post']).isRequired,
    created_at: PropTypes.number.isRequired,
    content: PropTypes.string,
    author: PropTypes.shape({
      pubkey: PropTypes.string.isRequired,
      profile: PropTypes.object
    }).isRequired,
    workout: PropTypes.object,
    images: PropTypes.arrayOf(PropTypes.string),
    reactions: PropTypes.shape({
      likes: PropTypes.number,
      reposts: PropTypes.number,
      zaps: PropTypes.number,
      comments: PropTypes.array
    }).isRequired
  }).isRequired,
  isLiked: PropTypes.bool.isRequired,
  isReposted: PropTypes.bool.isRequired,
  onLike: PropTypes.func.isRequired,
  onRepost: PropTypes.func.isRequired,
  onZap: PropTypes.func.isRequired,
  onComment: PropTypes.func.isRequired,
  wallet: PropTypes.object
};

Comment.propTypes = {
  comment: PropTypes.shape({
    id: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    created_at: PropTypes.number.isRequired,
    author: PropTypes.shape({
      pubkey: PropTypes.string.isRequired,
      profile: PropTypes.object
    }).isRequired
  }).isRequired,
  onReply: PropTypes.func.isRequired,
  onZap: PropTypes.func.isRequired
};

WorkoutSummary.propTypes = {
  workout: PropTypes.shape({
    title: PropTypes.string,
    type: PropTypes.string,
    duration: PropTypes.number,
    distance: PropTypes.number,
    exercises: PropTypes.array
  }).isRequired
}; 