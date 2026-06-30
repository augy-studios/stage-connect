// api/interactions/quiz.js
const {
    getSupabase
} = require('../../lib/supabase');
const {
    verifySession
} = require('../../lib/auth');
const {
    handleCors
} = require('../../lib/cors');
const {
    verifySignedRequest
} = require('../../lib/uwu-request-signing-server');
const crypto = require('crypto');

module.exports = async (req, res) => {
    if (handleCors(req, res)) return;
    const sb = getSupabase();
    const sig = await verifySignedRequest(req, sb);
    if (!sig.valid) return res.status(403).json({
        error: sig.reason
    });

    if (req.method === 'GET') {
        const {
            stageId
        } = req.query;
        const {
            data: questions
        } = await sb.from('uwustage_quiz').select('id, question, options, correct_option_id, points, time_limit_seconds, is_active, created_at').eq('stage_id', stageId).order('created_at', {
            ascending: true
        });
        if (!questions?.length) return res.status(200).json({ questions: [] });
        const { data: answers } = await sb.from('uwustage_quiz_answers')
            .select('quiz_id, chosen_option_id')
            .in('quiz_id', questions.map(q => q.id));
        const counts = {};
        (answers || []).forEach(a => {
            if (!counts[a.quiz_id]) counts[a.quiz_id] = {};
            counts[a.quiz_id][a.chosen_option_id] = (counts[a.quiz_id][a.chosen_option_id] || 0) + 1;
        });
        return res.status(200).json({
            questions: questions.map(q => ({ ...q, answer_counts: counts[q.id] || {} }))
        });
    }

    if (req.method === 'POST') {
        const {
            action,
            stageId,
            quizId
        } = req.body || {};

        if (action === 'answer') {
            // Public: submit answer
            const {
                chosenOptionId,
                playerToken,
                playerName
            } = req.body;
            const {
                data: q
            } = await sb.from('uwustage_quiz').select('correct_option_id, points').eq('id', quizId).single();
            if (!q) return res.status(404).json({
                error: 'Quiz not found.'
            });
            const is_correct = chosenOptionId === q.correct_option_id;
            const {
                error
            } = await sb.from('uwustage_quiz_answers').upsert({
                quiz_id: quizId,
                player_token: playerToken,
                player_name: playerName || 'Anonymous',
                chosen_option_id: chosenOptionId,
                is_correct
            }, {
                onConflict: 'quiz_id,player_token'
            });
            if (error) return res.status(500).json({
                error: 'Failed to submit answer.'
            });
            return res.status(200).json({
                correct: is_correct,
                points: is_correct ? q.points : 0
            });
        }

        // Auth required
        const user = await verifySession(req);
        if (!user) return res.status(401).json({
            error: 'Unauthorized'
        });

        if (action === 'create') {
            const {
                question,
                options,
                correctOption,
                points,
                timeLimitSeconds
            } = req.body;
            if (!question || options?.length < 2 || !correctOption) return res.status(400).json({
                error: 'Missing fields.'
            });
            const opts = options.map(text => ({
                id: crypto.randomBytes(6).toString('hex'),
                text
            }));
            const correct = opts.find(o => o.text === correctOption);
            if (!correct) return res.status(400).json({
                error: 'Correct answer not found in options.'
            });
            const {
                data,
                error
            } = await sb.from('uwustage_quiz').insert({
                stage_id: stageId,
                question,
                options: opts,
                correct_option_id: correct.id,
                points: points || 10,
                time_limit_seconds: timeLimitSeconds || 30
            }).select().single();
            if (error) return res.status(500).json({
                error: 'Failed to create question.'
            });
            return res.status(201).json({
                question: data
            });
        }

        if (action === 'toggle') {
            const {
                data: q
            } = await sb.from('uwustage_quiz').select('is_active').eq('id', quizId).single();
            await sb.from('uwustage_quiz').update({
                is_active: !q?.is_active
            }).eq('id', quizId);
            return res.status(200).json({
                success: true
            });
        }

        if (action === 'delete') {
            await sb.from('uwustage_quiz').delete().eq('id', quizId);
            return res.status(200).json({
                success: true
            });
        }
    }

    res.status(405).json({
        error: 'Method not allowed'
    });
};