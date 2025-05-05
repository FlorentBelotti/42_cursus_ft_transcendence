from rest_framework import serializers

class GameStateSerializer(serializers.Serializer):
    """
    Game state
    """
    match_id = serializers.CharField(required=False)
    player1_username = serializers.CharField(source='player_info.player1.username')
    player2_username = serializers.CharField(source='player_info.player2.username')
    player1_score = serializers.IntegerField(source='score.player1')
    player2_score = serializers.IntegerField(source='score.player2')
    
    class Meta:
        fields = ['match_id', 'player1_username', 'player2_username', 
                 'player1_score', 'player2_score']

class PaddleInputSerializer(serializers.Serializer):
    """
    Pad state
    """
    input = serializers.IntegerField(min_value=-1, max_value=1)

class MatchmakingSerializer(serializers.Serializer):
    """
    Matchmaking state
    """
    start = serializers.BooleanField(default=True)