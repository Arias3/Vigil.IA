import tensorflow as tf
from .constraints import MinMaxValueConstraint

class DrowsinessIndexLayer(tf.keras.layers.Layer):
    def __init__(self, num_gestures=3, **kwargs):
        super().__init__(**kwargs)
        self.num_gestures = num_gestures

    def build(self, input_shape):
        self.attention_weight = self.add_weight(
            name='attention_weight',
            shape=(1,),
            initializer=tf.keras.initializers.RandomUniform(minval=-2.0, maxval=-0.1),
            constraint=MinMaxValueConstraint(min_value=-3.0, max_value=-0.8),
            trainable=True
        )
        self.eyesclosed_weight = self.add_weight(
            name='eyesclosed_weight',
            shape=(1,),
            initializer=tf.keras.initializers.RandomUniform(minval=0.0, maxval=1.5),
            constraint=MinMaxValueConstraint(min_value=0.1, max_value=3.0),
            trainable=True
        )
        self.yawning_weight = self.add_weight(
            name='yawning_weight',
            shape=(1,),
            initializer=tf.keras.initializers.RandomUniform(minval=0.0, maxval=1.0),
            constraint=MinMaxValueConstraint(min_value=0.1, max_value=2.0),
            trainable=True
        )
        super().build(input_shape)

    def call(self, inputs):
        inputs_int = tf.cast(tf.squeeze(inputs, axis=-1), tf.int32)
        one_hot = tf.one_hot(inputs_int, depth=self.num_gestures)
        gesture_counts = tf.reduce_sum(one_hot, axis=1, keepdims=True)
        total_gestures = tf.maximum(tf.reduce_sum(gesture_counts, axis=2, keepdims=True), 1.0)
        gesture_freqs = gesture_counts / total_gestures

        attention_freq = gesture_freqs[:, :, 0]
        eyesclosed_freq = gesture_freqs[:, :, 1]
        yawning_freq = gesture_freqs[:, :, 2]

        drowsiness_contribution = (attention_freq * self.attention_weight) + \
                                 (eyesclosed_freq * self.eyesclosed_weight) + \
                                 (yawning_freq * self.yawning_weight)

        attention_effect_multiplier = tf.sigmoid(attention_freq * 2.0)
        drowsiness_index = tf.sigmoid(drowsiness_contribution * (1.0 + attention_effect_multiplier))
        drowsiness_index = tf.clip_by_value(drowsiness_index, 1e-7, 1.0-1e-7)

        return tf.reshape(drowsiness_index, [-1, 1])

    def get_config(self):
        config = super().get_config()
        config.update({'num_gestures': self.num_gestures})
        return config


class AttentionConsecutiveAdjustment(tf.keras.layers.Layer):
    def __init__(self, activation_threshold=100, saturation_point=160, max_reduction=0.30, **kwargs):
        super().__init__(**kwargs)
        self.activation_threshold = activation_threshold
        self.saturation_point = saturation_point
        self.max_reduction = max_reduction
        self.min_output = 0.01
        self.max_output = 1.0

    def call(self, inputs):
        drowsiness_index, gesture_sequence = inputs
        gestures = tf.squeeze(gesture_sequence, axis=-1)
        attention_mask = tf.cast(tf.equal(gestures, 0), tf.float32)

        def calculate_max_streak(mask):
            mask_1d = tf.squeeze(mask)
            streaks = tf.math.cumsum(mask_1d) * mask_1d
            return tf.cast(tf.reduce_max(streaks), tf.float32)

        max_streaks = tf.map_fn(
            calculate_max_streak,
            attention_mask,
            fn_output_signature=tf.float32
        )
        max_streaks = tf.reshape(max_streaks, (-1, 1))

        def compute_reduction(streak):
            excess = tf.maximum(streak - self.activation_threshold, 0.0)
            scale = tf.math.log(1.0 + excess / (self.saturation_point - self.activation_threshold + 1e-7))
            return self.max_reduction * tf.tanh(scale)

        reduction = tf.map_fn(
            compute_reduction,
            max_streaks,
            fn_output_signature=tf.float32
        )
        reduction = tf.reshape(reduction, (-1, 1))

        adjusted_index = drowsiness_index * (1.0 - reduction)
        adjusted_index = tf.clip_by_value(adjusted_index, self.min_output, self.max_output)

        return tf.reshape(adjusted_index, [-1, 1])

    def get_config(self):
        config = super().get_config()
        config.update({
            'activation_threshold': self.activation_threshold,
            'saturation_point': self.saturation_point,
            'max_reduction': self.max_reduction
        })
        return config
    
class EyesClosedConsecutiveAdjustment(tf.keras.layers.Layer):
    def __init__(self, initial_threshold=5, saturation_point=10, saturation_strength=1.0, max_adjustment=0.20, **kwargs):
        super().__init__(**kwargs)
        self.initial_threshold = initial_threshold
        self.saturation_point = saturation_point
        self.saturation_strength = saturation_strength
        self.max_adjustment = max_adjustment

    def call(self, inputs):
        drowsiness_index, gesture_sequence = inputs
        gestures = tf.squeeze(gesture_sequence, axis=-1)
        eyesclosed_mask = tf.cast(tf.equal(gestures, 1), tf.float32)

        def calculate_adjustment(mask):
            mask_1d = tf.squeeze(mask)
            streaks = tf.math.cumsum(mask_1d) * mask_1d
            max_streak = tf.reduce_max(streaks)
            max_streak = tf.cast(max_streak, tf.float32)
            safe_saturation_point = tf.maximum(1.0, tf.cast(self.saturation_point - self.initial_threshold, dtype=tf.float32))
            saturation = tf.sigmoid((max_streak - self.initial_threshold) / safe_saturation_point * self.saturation_strength)
            adjustment = self.max_adjustment * saturation
            adjustment = tf.where(max_streak >= self.initial_threshold, adjustment, tf.constant(0.0, dtype=tf.float32))
            return adjustment

        streak_adjustments = tf.map_fn(
            calculate_adjustment,
            eyesclosed_mask,
            fn_output_signature=tf.float32
        )
        streak_adjustments = tf.reshape(streak_adjustments, (-1, 1))

        return tf.clip_by_value(drowsiness_index + streak_adjustments, 0.0, 1.0)

    def get_config(self):
        config = super().get_config()
        config.update({
            'initial_threshold': self.initial_threshold,
            'saturation_point': self.saturation_point,
            'saturation_strength': self.saturation_strength,
            'max_adjustment': self.max_adjustment
        })
        return config
    
class YawningConsecutiveAdjustment(tf.keras.layers.Layer):
    def __init__(self, min_streak_high_impact=4, min_streak_low_impact=7,
                 min_streaks_high_activate=2, min_streaks_low_activate=3,
                 high_impact_initial=0.18, low_impact_initial=0.05,
                 max_adjustment=0.35, high_decay_rate=0.5, low_decay_rate=0.5, **kwargs):
        super().__init__(**kwargs)
        self.min_streak_high_impact = min_streak_high_impact
        self.min_streak_low_impact = min_streak_low_impact
        self.min_streaks_high_activate = min_streaks_high_activate
        self.min_streaks_low_activate = min_streaks_low_activate
        self.high_impact_initial = high_impact_initial
        self.low_impact_initial = low_impact_initial
        self.max_adjustment = max_adjustment
        self.high_decay_rate = high_decay_rate
        self.low_decay_rate = low_decay_rate

    def call(self, inputs):
        drowsiness_index, gesture_sequence = inputs
        gestures = tf.squeeze(gesture_sequence, axis=-1)
        yawning_mask = tf.cast(tf.equal(gestures, 2), tf.float32)

        def process_sample(mask):
            mask_1d = tf.squeeze(mask)
            changes = tf.not_equal(mask_1d[:-1], mask_1d[1:])
            indices = tf.squeeze(tf.where(changes), axis=-1)
            indices = tf.concat([[0], indices + 1, [tf.size(mask_1d)]], axis=0)
            streak_lengths = indices[1:] - indices[:-1]
            is_yawning_streak = tf.equal(tf.gather(mask_1d, indices[:-1]), 1.0)
            streak_lengths = tf.boolean_mask(streak_lengths, is_yawning_streak)

            high_impact = tf.reduce_sum(tf.cast(streak_lengths >= self.min_streak_high_impact, tf.int32))
            low_impact = tf.reduce_sum(tf.cast(streak_lengths >= self.min_streak_low_impact, tf.int32))

            high_adjust = self.high_impact_initial * tf.exp(-self.high_decay_rate * tf.cast(high_impact - self.min_streaks_high_activate, tf.float32))
            high_adjust = tf.where(high_impact >= self.min_streaks_high_activate, high_adjust, 0.0)

            low_adjust = self.low_impact_initial * tf.exp(-self.low_decay_rate * tf.cast(low_impact - self.min_streaks_low_activate, tf.float32))
            low_adjust = tf.where(low_impact >= self.min_streaks_low_activate, low_adjust, 0.0)

            total_adjust = high_adjust + low_adjust
            return tf.minimum(total_adjust, self.max_adjustment)

        adjustments = tf.map_fn(
            process_sample,
            yawning_mask,
            fn_output_signature=tf.float32
        )
        adjustments = tf.reshape(adjustments, (-1, 1))

        adjusted_index = drowsiness_index + adjustments
        return tf.clip_by_value(adjusted_index, 0.0, 1.0)

    def get_config(self):
        config = super().get_config()
        config.update({
            'min_streak_high_impact': self.min_streak_high_impact,
            'min_streak_low_impact': self.min_streak_low_impact,
            'min_streaks_high_activate': self.min_streaks_high_activate,
            'min_streaks_low_activate': self.min_streaks_low_activate,
            'high_impact_initial': self.high_impact_initial,
            'low_impact_initial': self.low_impact_initial,
            'max_adjustment': self.max_adjustment,
            'high_decay_rate': self.high_decay_rate,
            'low_decay_rate': self.low_decay_rate
        })
        return config
    

class CombinedConsecutiveAdjustment(tf.keras.layers.Layer):
    def __init__(self, eyesclosed_threshold=40, attention_threshold=40,
                 max_adjustment=0.05, saturation_point=160, **kwargs):
        super().__init__(**kwargs)
        self.eyesclosed_threshold = eyesclosed_threshold
        self.attention_threshold = attention_threshold
        self.max_adjustment = max_adjustment
        self.saturation_point = saturation_point
        self.min_output = 0.01
        self.max_output = 1.0

    def call(self, inputs):
        drowsiness_index, gesture_sequence = inputs
        gestures = tf.squeeze(gesture_sequence, axis=-1)
        eyesclosed_mask = tf.cast(tf.equal(gestures, 1), tf.float32)
        attention_mask = tf.cast(tf.equal(gestures, 0), tf.float32)

        batch_size = tf.shape(gestures)[0]

        def process_batch_element(i):
            current_eyesclosed = eyesclosed_mask[i]
            current_attention = attention_mask[i]
            eyesclosed_streaks = tf.math.cumsum(current_eyesclosed) * current_eyesclosed
            max_eyesclosed_streak = tf.reduce_max(eyesclosed_streaks)

            adjustment = tf.cond(
                max_eyesclosed_streak >= self.eyesclosed_threshold,
                lambda: self._calculate_attention_adjustment(current_attention, eyesclosed_streaks),
                lambda: tf.constant(0.0, dtype=tf.float32)
            )
            return adjustment

        adjustments = tf.map_fn(
            process_batch_element,
            tf.range(batch_size),
            fn_output_signature=tf.float32
        )
        adjustments = tf.reshape(adjustments, (-1, 1))

        adjusted_index = drowsiness_index * (1.0 - adjustments)
        adjusted_index = tf.minimum(adjusted_index, self.max_output)
        adjusted_index = tf.maximum(adjusted_index, self.min_output)

        return adjusted_index

    def _calculate_attention_adjustment(self, attention_mask, eyesclosed_streaks):
        max_streak_pos = tf.argmax(eyesclosed_streaks)
        attention_after = attention_mask[max_streak_pos+1:]
        attention_streaks = tf.math.cumsum(attention_after) * attention_after
        max_attention_streak = tf.reduce_max(attention_streaks)

        return tf.cond(
            max_attention_streak >= self.attention_threshold,
            lambda: self._compute_adjustment_value(max_attention_streak),
            lambda: tf.constant(0.0, dtype=tf.float32)
        )

    def _compute_adjustment_value(self, max_attention_streak):
        excess = tf.maximum(max_attention_streak - self.attention_threshold, 0.0)
        return self.max_adjustment * (1.0 - tf.exp(-excess/(self.saturation_point/3)))

    def get_config(self):
        config = super().get_config()
        config.update({
            'eyesclosed_threshold': self.eyesclosed_threshold,
            'attention_threshold': self.attention_threshold,
            'max_adjustment': self.max_adjustment,
            'saturation_point': self.saturation_point
        })
        return config
    
class ExtremeValueAdjustment(tf.keras.layers.Layer):
    def __init__(self,
                 max_eyesclosed_streak=50,
                 max_attention_streak=240,
                 **kwargs):
        super().__init__(**kwargs)
        self.max_eyesclosed_streak = max_eyesclosed_streak
        self.max_attention_streak = max_attention_streak

    def call(self, inputs):
        drowsiness_index, gesture_sequence = inputs
        gestures = tf.squeeze(gesture_sequence, axis=-1)  # (batch, seq_len)
        adjusted_index = self._apply_eyesclosed_adjustment(drowsiness_index, gestures)
        adjusted_index = self._apply_attention_adjustment(adjusted_index, gestures)
        return tf.clip_by_value(adjusted_index, 0.0, 1.0)

    def _apply_eyesclosed_adjustment(self, index, gestures):
        eyesclosed_mask = tf.cast(tf.equal(gestures, 1), tf.int32)

        def calculate_final_streak(mask):
            reversed_mask = tf.reverse(mask, axis=[0])
            streak = tf.argmax(tf.not_equal(reversed_mask, 1), output_type=tf.int32)
            is_all = tf.reduce_all(tf.equal(mask, 1))
            return tf.where(is_all, tf.shape(mask)[0], streak)

        final_streaks = tf.map_fn(calculate_final_streak, eyesclosed_mask, fn_output_signature=tf.int32)

        def compute_increment(streak):
                streak_f = tf.cast(streak, tf.float32)
                increment = tf.constant(0.0, dtype=tf.float32)

                # Entre 1 y 15: Incremento lineal y rápido hasta un punto intermedio
                case1 = tf.logical_and(streak_f >= 1, streak_f <= 15)
                inc1 = 0.002 + 0.028 * (streak_f - 1) / 14  # Alcanza 0.03 al llegar a 15

                # Entre 16 y 40: Incremento más lento, usando una raíz cuadrada para desacelerar
                case2 = tf.logical_and(streak_f > 15, streak_f <= 40)
                inc2 = 0.03 + 0.025 * tf.sqrt((streak_f - 15) / 25) # Sube otros 0.025, llegando a 0.055

                # A partir de 41: Incremento muy suave con una función exponencial decreciente, acercándose a 0.065
                case3 = streak_f > 40
                extra = streak_f - 40
                inc3 = 0.055 + (0.065 - 0.055) * (1 - tf.exp(-0.05 * extra)) # Sube los últimos 0.01 suavemente

                increment = tf.where(case1, inc1, increment)
                increment = tf.where(case2, inc2, increment)
                increment = tf.where(case3, inc3, increment)

                return increment

        increments = tf.map_fn(compute_increment, final_streaks, fn_output_signature=tf.float32)
        safe_increment = tf.minimum(increments, 1.0 - tf.squeeze(index, axis=-1))
        return index + tf.expand_dims(safe_increment, axis=-1)

    def _apply_attention_adjustment(self, index, gestures):
        attention_mask = tf.cast(tf.equal(gestures, 0), tf.int32)

        def calculate_final_streak(mask):
            reversed_mask = tf.reverse(mask, axis=[0])
            streak = tf.argmax(tf.not_equal(reversed_mask, 0), output_type=tf.int32)
            is_all = tf.reduce_all(tf.equal(mask, 0))
            return tf.where(is_all, tf.shape(mask)[0], streak)

        final_streaks = tf.map_fn(calculate_final_streak, attention_mask, fn_output_signature=tf.int32)

        def compute_reduction(streak_and_index):
            streak, idx = streak_and_index
            streak_f = tf.cast(streak, tf.float32)
            reduction = tf.constant(0.0, dtype=tf.float32)

            case1 = tf.logical_and(streak_f >= 120, streak_f <= 160)
            red1 = -0.015 - 0.03 * (streak_f - 120) / 40

            case2 = tf.logical_and(streak_f > 160, streak_f < 240)
            red2 = -0.045 - 0.055 * (streak_f - 160) / 79

            case3 = tf.equal(streak_f, 240)
            red3 = -idx

            reduction = tf.where(case1, red1, reduction)
            reduction = tf.where(case2, red2, reduction)
            reduction = tf.where(case3, red3, reduction)

            return reduction

        index_flat = tf.squeeze(index, axis=-1)
        input_tuple = (final_streaks, index_flat)
        reductions = tf.map_fn(compute_reduction, input_tuple, fn_output_signature=tf.float32)
        safe_reduction = tf.maximum(reductions, -index_flat)
        return index + tf.expand_dims(safe_reduction, axis=-1)

    def get_config(self):
        config = super().get_config()
        config.update({
            'max_eyesclosed_streak': self.max_eyesclosed_streak,
            'max_attention_streak': self.max_attention_streak
        })
        return config

    def compute_output_shape(self, input_shape):
        return input_shape[0]