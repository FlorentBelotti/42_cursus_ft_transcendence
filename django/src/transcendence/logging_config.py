import os
import logging.config

def configure_logging(base_dir):
    """Configure the logging settings for the application."""
    logs_dir = os.path.join(base_dir, 'logs')
    
    # Create logs directory if it doesn't exist
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)
    
    # Configuration for the Django logging system
    LOGGING = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'verbose': {
                'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
                'style': '{',
            },
            'simple': {
                'format': '{levelname} {asctime} {message}',
                'style': '{',
            },
            'pong': {
                'format': '{levelname} [{asctime}] {name}: {message}',
                'style': '{',
            },
        },
        'filters': {
            'require_debug_true': {
                '()': 'django.utils.log.RequireDebugTrue',
            },
        },
        'handlers': {
            'console': {
                'level': 'INFO',
                'class': 'logging.StreamHandler',
                'formatter': 'simple',
            },
            'file': {
                'level': 'INFO',
                'class': 'logging.FileHandler',
                'filename': os.path.join(logs_dir, 'django.log'),
                'formatter': 'verbose',
            },
            'pong_file': {
                'level': 'DEBUG',
                'class': 'logging.FileHandler',
                'filename': os.path.join(logs_dir, 'pong.log'),
                'formatter': 'pong',
            },
            'api_file': {
                'level': 'DEBUG',
                'class': 'logging.FileHandler',
                'filename': os.path.join(logs_dir, 'api.log'),
                'formatter': 'pong',
            },
            'lobby_file': {
                'level': 'DEBUG',
                'class': 'logging.FileHandler',
                'filename': os.path.join(logs_dir, 'lobby.log'),
                'formatter': 'pong',
            },
        },
        'loggers': {
            'django': {
                'handlers': ['console', 'file'],
                'level': 'INFO',
                'propagate': True,
            },
            'pong': {
                'handlers': ['console', 'pong_file'],
                'level': 'DEBUG',
                'propagate': False,
            },
            'pong.api': {
                'handlers': ['console', 'api_file'],
                'level': 'DEBUG',
                'propagate': False,
            },
            'pong.lobby': {
                'handlers': ['console', 'lobby_file'],
                'level': 'DEBUG',
                'propagate': False,
            },
        },
    }
    
    # Apply the configuration
    logging.config.dictConfig(LOGGING)
    
    return LOGGING